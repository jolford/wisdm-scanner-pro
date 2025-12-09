# WISDM Script Agent for Windows

A lightweight Windows service that executes PowerShell, VBScript, Python, and Batch scripts triggered by the WISDM web application.

## Features

- **PowerShell Execution** - Run PowerShell scripts with full system access
- **VBScript Support** - Execute legacy VBScript automation
- **Python Scripts** - Run Python scripts (requires Python installed)
- **Batch Files** - Execute Windows batch files
- **Automatic Polling** - Continuously checks for pending jobs
- **Secure Communication** - API key authentication with SHA-256 hashing
- **Retry Logic** - Automatic retry on failure with configurable limits
- **Heartbeat Monitoring** - Web dashboard shows agent status

## Installation

### Prerequisites

- Windows 10/11 or Windows Server 2016+
- Node.js 18+ (for running the agent)
- Python 3.8+ (optional, for Python scripts)
- Administrator privileges (for some scripts)

### Quick Start

1. Download and extract the agent package
2. Run `npm install` to install dependencies
3. Configure your API key in `config.json`
4. Run `npm start` to start the agent

### Configuration

Create `config.json`:

```json
{
  "apiKey": "YOUR_API_KEY_FROM_WEB_DASHBOARD",
  "apiUrl": "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/script-agent-api",
  "pollIntervalMs": 5000,
  "maxConcurrentJobs": 3,
  "logLevel": "info"
}
```

### Getting Your API Key

1. Go to Admin → Script Agents in the web application
2. Click "Register New Agent"
3. Enter a name for this agent
4. Copy the generated API key (shown only once!)
5. Paste into your `config.json`

## Running as a Windows Service

To run the agent as a Windows service that starts automatically:

```powershell
# Install as service (run as Administrator)
npm run install-service

# Uninstall service
npm run uninstall-service
```

## Script Execution

### PowerShell Scripts

Scripts run in a new PowerShell process with:
- ExecutionPolicy: Bypass (for this session only)
- Working directory: Agent install folder
- Environment variables: Passed from job parameters

### Security Considerations

- Scripts run with the same permissions as the agent process
- For elevated operations, run the agent service as a privileged user
- API keys are stored locally - protect your `config.json`
- Network traffic is encrypted via HTTPS

## Troubleshooting

### Agent Not Showing as Online

1. Check `config.json` has correct API key
2. Verify network connectivity to API URL
3. Check Windows Firewall allows outbound HTTPS

### Scripts Not Executing

1. Check agent has required runtime (Python, etc.)
2. Verify script language is in supported list
3. Check Windows Event Viewer for errors

### Logs

Logs are stored in `logs/agent.log` with rotation.

## API Reference

The agent communicates with these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| /poll | GET | Get pending jobs |
| /heartbeat | POST | Send heartbeat |
| /claim | POST | Claim a job |
| /start | POST | Mark job as running |
| /complete | POST | Submit job results |
| /fail | POST | Report job failure |

## Support

For issues and feature requests, contact your WISDM administrator.
