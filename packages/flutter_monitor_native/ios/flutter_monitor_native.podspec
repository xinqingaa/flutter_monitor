Pod::Spec.new do |s|
  s.name             = 'flutter_monitor_native'
  s.version          = '2.0.0'
  s.summary          = 'Optional Flutter Monitor native bridge.'
  s.description      = 'Native bridge for Flutter Monitor memory, pressure, and lifecycle signals.'
  s.homepage         = 'https://github.com/xinqingaa/flutter_monitor'
  s.license          = { :type => 'MIT' }
  s.author           = { 'Flutter Monitor' => 'flutter_monitor@example.com' }
  s.source           = { :path => '.' }
  s.source_files = 'Classes/**/*'
  s.dependency 'Flutter'
  s.platform = :ios, '12.0'
  s.swift_version = '5.0'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
