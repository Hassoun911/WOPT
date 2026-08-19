Pod::Spec.new do |s|
  s.name           = 'PrayerAudio'
  s.version        = '1.0.0'
  s.summary        = 'Hassoun prayer platform bridge'
  s.description    = 'Platform-safe prayer API and foreground location support for Hassoun on iOS.'
  s.author         = 'Hassoun'
  s.homepage       = 'https://hassoun911.github.io/WOPT/'
  s.license        = { :type => 'MIT' }
  s.platform       = :ios, '16.4'
  s.source         = { :git => 'https://github.com/Hassoun911/WOPT.git', :tag => s.version.to_s }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CoreLocation'
  s.source_files = '**/*.swift'
  s.swift_version = '5.9'
end
