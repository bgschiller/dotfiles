import CoreAudio
import Foundation

// Process input activity distinguishes microphone capture from speaker playback
// on duplex devices (e.g. headsets). This query does not open the microphone.
if #available(macOS 14.2, *) {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyProcessObjectList,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    let system = AudioObjectID(kAudioObjectSystemObject)
    var size: UInt32 = 0
    guard AudioObjectGetPropertyDataSize(system, &address, 0, nil, &size) == noErr else { exit(1) }
    let stride = MemoryLayout<AudioObjectID>.stride
    guard Int(size) % stride == 0 else { exit(1) }
    var processes = [AudioObjectID](repeating: 0, count: Int(size) / stride)
    if size > 0 {
        let status = processes.withUnsafeMutableBytes {
            AudioObjectGetPropertyData(system, &address, 0, nil, &size, $0.baseAddress!)
        }
        guard status == noErr else { exit(1) }
    }
    for process in processes.prefix(Int(size) / stride) {
        var inputAddress = AudioObjectPropertyAddress(
            mSelector: kAudioProcessPropertyIsRunningInput,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )
        var running: UInt32 = 0
        var runningSize = UInt32(MemoryLayout<UInt32>.size)
        guard AudioObjectGetPropertyData(process, &inputAddress, 0, nil, &runningSize, &running) == noErr,
              runningSize == MemoryLayout<UInt32>.size else { exit(1) }
        if running != 0 {
            print("active")
            exit(0)
        }
    }
    print("inactive")
} else {
    exit(1)
}
