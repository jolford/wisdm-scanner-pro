#include <napi.h>
#include <windows.h>
#include <vector>
#include <string>

// Include Ricoh SDK headers
// NOTE: Adjust these includes based on your actual Ricoh SDK structure
#include "PfuSsApi.h"

using namespace Napi;

// Global SDK handle
static HANDLE g_hScanner = NULL;
static bool g_bInitialized = false;

/**
 * Initialize Ricoh Scanner SDK
 */
Napi::Object Initialize(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Object result = Napi::Object::New(env);

  if (g_bInitialized) {
    result.Set("success", true);
    result.Set("message", "Already initialized");
    return result;
  }

  // Initialize Ricoh SDK
  DWORD dwRet = PfuSsInitialize();
  
  if (dwRet != SS_SUCCESS) {
    result.Set("success", false);
    result.Set("error", "Failed to initialize Ricoh SDK");
    result.Set("errorCode", (int)dwRet);
    return result;
  }

  g_bInitialized = true;
  result.Set("success", true);
  result.Set("message", "Ricoh SDK initialized successfully");
  
  return result;
}

/**
 * Get list of available scanners
 */
Napi::Array GetScanners(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Array scanners = Napi::Array::New(env);

  if (!g_bInitialized) {
    return scanners;
  }

  // Get scanner count
  DWORD dwScannerCount = 0;
  DWORD dwRet = PfuSsGetDeviceCount(&dwScannerCount);

  if (dwRet != SS_SUCCESS || dwScannerCount == 0) {
    return scanners;
  }

  // Enumerate scanners
  for (DWORD i = 0; i < dwScannerCount; i++) {
    SS_DEVICE_INFO deviceInfo;
    ZeroMemory(&deviceInfo, sizeof(SS_DEVICE_INFO));

    dwRet = PfuSsGetDeviceInfo(i, &deviceInfo);
    
    if (dwRet == SS_SUCCESS) {
      Napi::Object scanner = Napi::Object::New(env);
      scanner.Set("id", (int)i);
      scanner.Set("name", deviceInfo.szModelName);
      scanner.Set("vendor", "Ricoh/Fujitsu");
      scanner.Set("serialNumber", deviceInfo.szSerialNumber);
      
      scanners.Set(i, scanner);
    }
  }

  return scanners;
}

/**
 * Perform scan operation
 */
Napi::Object Scan(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Object result = Napi::Object::New(env);

  if (!g_bInitialized) {
    result.Set("success", false);
    result.Set("error", "SDK not initialized");
    return result;
  }

  // Parse options
  Napi::Object options = info[0].As<Napi::Object>();
  
  int scannerId = options.Get("scannerId").As<Napi::Number>().Int32Value();
  int resolution = options.Get("resolution").As<Napi::Number>().Int32Value();
  std::string colorMode = options.Get("colorMode").As<Napi::String>().Utf8Value();
  bool duplex = options.Get("duplex").As<Napi::Boolean>().Value();
  std::string outputPath = options.Get("outputPath").As<Napi::String>().Utf8Value();

  // Open scanner
  DWORD dwRet = PfuSsOpenDevice(scannerId, &g_hScanner);
  
  if (dwRet != SS_SUCCESS) {
    result.Set("success", false);
    result.Set("error", "Failed to open scanner");
    result.Set("errorCode", (int)dwRet);
    return result;
  }

  // Configure scan settings
  SS_SCAN_PARAM scanParam;
  ZeroMemory(&scanParam, sizeof(SS_SCAN_PARAM));
  
  scanParam.dwResolution = resolution;
  
  // Set color mode
  if (colorMode == "color") {
    scanParam.dwPixelType = SS_PIXELTYPE_COLOR;
  } else if (colorMode == "grayscale") {
    scanParam.dwPixelType = SS_PIXELTYPE_GRAY;
  } else {
    scanParam.dwPixelType = SS_PIXELTYPE_BW;
  }
  
  // Set duplex
  scanParam.dwDuplex = duplex ? SS_DUPLEX_ON : SS_DUPLEX_OFF;
  
  // Set paper size (A4)
  scanParam.dwPaperSize = SS_PAPERSIZE_A4;
  
  // Apply settings
  dwRet = PfuSsSetScanParam(g_hScanner, &scanParam);
  
  if (dwRet != SS_SUCCESS) {
    PfuSsCloseDevice(g_hScanner);
    result.Set("success", false);
    result.Set("error", "Failed to set scan parameters");
    result.Set("errorCode", (int)dwRet);
    return result;
  }

  // Perform scan
  dwRet = PfuSsStartScan(g_hScanner);
  
  if (dwRet != SS_SUCCESS) {
    PfuSsCloseDevice(g_hScanner);
    result.Set("success", false);
    result.Set("error", "Failed to start scan");
    result.Set("errorCode", (int)dwRet);
    return result;
  }

  // Get scanned image data
  SS_IMAGE_DATA imageData;
  ZeroMemory(&imageData, sizeof(SS_IMAGE_DATA));
  
  int pageCount = 0;
  
  while (PfuSsGetImageData(g_hScanner, &imageData) == SS_SUCCESS) {
    pageCount++;
    
    // Save image data to file (simplified - you may need to use a PDF library)
    // For now, this is a placeholder that would need actual PDF creation logic
    
    // Free image data
    PfuSsFreeImageData(&imageData);
  }

  // Close scanner
  PfuSsCloseDevice(g_hScanner);
  g_hScanner = NULL;

  result.Set("success", true);
  result.Set("pageCount", pageCount);
  result.Set("outputPath", outputPath);

  return result;
}

/**
 * Cleanup and uninitialize SDK
 */
void Cleanup(const Napi::CallbackInfo& info) {
  if (g_hScanner != NULL) {
    PfuSsCloseDevice(g_hScanner);
    g_hScanner = NULL;
  }

  if (g_bInitialized) {
    PfuSsUninitialize();
    g_bInitialized = false;
  }
}

/**
 * Module initialization
 */
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("initialize", Napi::Function::New(env, Initialize));
  exports.Set("getScanners", Napi::Function::New(env, GetScanners));
  exports.Set("scan", Napi::Function::New(env, Scan));
  exports.Set("cleanup", Napi::Function::New(env, Cleanup));
  
  return exports;
}

NODE_API_MODULE(ricoh_scanner, Init)
