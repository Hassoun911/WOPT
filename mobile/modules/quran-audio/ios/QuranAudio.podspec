Pod::Spec.new do |s|
  s.name           = 'QuranAudio'
  s.version        = '0.1.0'
  s.summary        = 'Native Quran audio playback for Hassoun'
  s.description    = 'Background-capable Quran audio playback for the Hassoun app.'
  s.license        = { :type => 'MIT' }
  s.author         = 'Hassoun'
  s.homepage       = 'https://github.com/Hassoun911/WOPT'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { :git => 'https://github.com/Hassoun911/WOPT.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
