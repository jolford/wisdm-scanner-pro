{
  "targets": [
    {
      "target_name": "ricoh-scanner",
      "sources": [
        "ricoh-scanner.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "C:/Ricoh SDK/include"
      ],
      "libraries": [
        "C:/Ricoh SDK/lib/x64/PfuSsApiLib.lib"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": ["/EHsc"]
        }
      }
    }
  ]
}
