Pod::Spec.new do |s|
  s.name = 'EbbLocalAi'
  s.version = '1.0.0'
  s.summary = 'Private local meal storage for Ebb'
  s.description = 'App-private, backup-excluded storage and streaming model verification.'
  s.license = { :type => 'Proprietary' }
  s.author = 'Ebb'
  s.homepage = 'https://expo.dev'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
