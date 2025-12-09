/**
 * WISDM Script Agent for Windows
 * 
 * Polls for pending script jobs and executes them locally.
 */

const https = require('https');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load configuration
const configPath = path.join(__dirname, 'config.json');
let config;

try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('Failed to load config.json:', error.message);
  console.log('Please create config.json with your API key. See README.md for details.');
  process.exit(1);
}

const {
  apiKey,
  apiUrl = 'https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/script-agent-api',
  pollIntervalMs = 5000,
  maxConcurrentJobs = 3,
  logLevel = 'info'
} = config;

if (!apiKey) {
  console.error('API key not configured in config.json');
  process.exit(1);
}

// Simple logging
const log = {
  info: (...args) => logLevel !== 'error' && console.log(new Date().toISOString(), '[INFO]', ...args),
  error: (...args) => console.error(new Date().toISOString(), '[ERROR]', ...args),
  debug: (...args) => logLevel === 'debug' && console.log(new Date().toISOString(), '[DEBUG]', ...args)
};

// Track running jobs
let runningJobs = 0;
let isShuttingDown = false;

/**
 * Make API request
 */
function apiRequest(action, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(apiUrl);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: `${url.pathname}/${action}`,
      method,
      headers: {
        'X-Agent-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

/**
 * Execute a script based on language
 */
function executeScript(job) {
  return new Promise((resolve) => {
    const { script_language, script_content, script_parameters, timeout_seconds } = job;
    
    let command, args, tempFile;
    const tempDir = path.join(__dirname, 'temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    switch (script_language) {
      case 'powershell':
        tempFile = path.join(tempDir, `script_${job.id}.ps1`);
        fs.writeFileSync(tempFile, script_content);
        command = 'powershell.exe';
        args = ['-ExecutionPolicy', 'Bypass', '-File', tempFile];
        break;
        
      case 'python':
        tempFile = path.join(tempDir, `script_${job.id}.py`);
        fs.writeFileSync(tempFile, script_content);
        command = 'python';
        args = [tempFile];
        break;
        
      case 'vbscript':
        tempFile = path.join(tempDir, `script_${job.id}.vbs`);
        fs.writeFileSync(tempFile, script_content);
        command = 'cscript.exe';
        args = ['//NoLogo', tempFile];
        break;
        
      case 'batch':
        tempFile = path.join(tempDir, `script_${job.id}.bat`);
        fs.writeFileSync(tempFile, script_content);
        command = 'cmd.exe';
        args = ['/c', tempFile];
        break;
        
      case 'javascript':
        tempFile = path.join(tempDir, `script_${job.id}.js`);
        fs.writeFileSync(tempFile, script_content);
        command = 'node';
        args = [tempFile];
        break;
        
      default:
        resolve({
          success: false,
          error_message: `Unsupported script language: ${script_language}`
        });
        return;
    }

    log.info(`Executing ${script_language} script: ${job.script_name}`);

    // Set up environment variables from parameters
    const env = { ...process.env };
    if (script_parameters) {
      Object.entries(script_parameters).forEach(([key, value]) => {
        env[`WISDM_${key.toUpperCase()}`] = String(value);
      });
      // Also pass as JSON
      env.WISDM_PARAMS = JSON.stringify(script_parameters);
    }

    const proc = spawn(command, args, {
      env,
      cwd: __dirname,
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    // Timeout handling
    const timeout = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
      log.error(`Script timed out after ${timeout_seconds}s`);
    }, (timeout_seconds || 300) * 1000);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      log.debug('stdout:', data.toString().trim());
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      log.debug('stderr:', data.toString().trim());
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      
      // Clean up temp file
      try {
        if (tempFile && fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (e) {
        log.error('Failed to clean up temp file:', e.message);
      }

      if (killed) {
        resolve({
          success: false,
          error_message: `Script execution timed out after ${timeout_seconds} seconds`,
          stdout: stdout.substring(0, 10000),
          stderr: stderr.substring(0, 10000)
        });
      } else if (code === 0) {
        resolve({
          success: true,
          exit_code: code,
          stdout: stdout.substring(0, 50000),
          stderr: stderr.substring(0, 10000)
        });
      } else {
        resolve({
          success: false,
          exit_code: code,
          error_message: `Script exited with code ${code}`,
          stdout: stdout.substring(0, 10000),
          stderr: stderr.substring(0, 10000)
        });
      }
    });

    proc.on('error', (error) => {
      clearTimeout(timeout);
      resolve({
        success: false,
        error_message: `Failed to start process: ${error.message}`
      });
    });
  });
}

/**
 * Process a single job
 */
async function processJob(job) {
  runningJobs++;
  log.info(`Processing job ${job.id}: ${job.script_name} (${job.script_language})`);

  try {
    // Claim the job
    await apiRequest('claim', 'POST', { job_id: job.id });
    
    // Mark as running
    await apiRequest('start', 'POST', { job_id: job.id });

    // Execute the script
    const result = await executeScript(job);

    if (result.success) {
      // Complete the job
      await apiRequest('complete', 'POST', {
        job_id: job.id,
        exit_code: result.exit_code,
        stdout: result.stdout,
        stderr: result.stderr,
        result_data: result.result_data
      });
      log.info(`Job ${job.id} completed successfully`);
    } else {
      // Report failure
      await apiRequest('fail', 'POST', {
        job_id: job.id,
        error_message: result.error_message,
        stdout: result.stdout,
        stderr: result.stderr
      });
      log.error(`Job ${job.id} failed: ${result.error_message}`);
    }

  } catch (error) {
    log.error(`Error processing job ${job.id}:`, error.message);
    try {
      await apiRequest('fail', 'POST', {
        job_id: job.id,
        error_message: error.message
      });
    } catch (e) {
      log.error('Failed to report job failure:', e.message);
    }
  } finally {
    runningJobs--;
  }
}

/**
 * Poll for jobs
 */
async function poll() {
  if (isShuttingDown) return;

  try {
    // Send heartbeat and get jobs
    const response = await apiRequest('poll', 'GET');
    const jobs = response.jobs || [];

    log.debug(`Poll returned ${jobs.length} pending jobs, ${runningJobs} currently running`);

    // Process jobs up to concurrency limit
    for (const job of jobs) {
      if (runningJobs >= maxConcurrentJobs) {
        log.debug('Max concurrent jobs reached, waiting...');
        break;
      }
      // Don't await - process in parallel
      processJob(job).catch(e => log.error('Job processing error:', e));
    }

  } catch (error) {
    log.error('Poll error:', error.message);
  }

  // Schedule next poll
  if (!isShuttingDown) {
    setTimeout(poll, pollIntervalMs);
  }
}

/**
 * Graceful shutdown
 */
function shutdown() {
  log.info('Shutting down...');
  isShuttingDown = true;
  
  // Wait for running jobs to complete (max 30 seconds)
  const checkInterval = setInterval(() => {
    if (runningJobs === 0) {
      clearInterval(checkInterval);
      log.info('All jobs completed. Goodbye!');
      process.exit(0);
    }
  }, 1000);

  setTimeout(() => {
    clearInterval(checkInterval);
    log.error('Forced shutdown - some jobs may not have completed');
    process.exit(1);
  }, 30000);
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the agent
log.info('WISDM Script Agent starting...');
log.info(`API URL: ${apiUrl}`);
log.info(`Poll interval: ${pollIntervalMs}ms`);
log.info(`Max concurrent jobs: ${maxConcurrentJobs}`);

// Initial poll
poll();

log.info('Agent is running. Press Ctrl+C to stop.');
