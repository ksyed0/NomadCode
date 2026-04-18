import Foundation
import React

@objc(KeyboardShortcuts)
class KeyboardShortcuts: RCTEventEmitter {

  private static let supportedShortcuts: [(key: UIKeyboardHIDUsage, modifiers: UIKeyModifierFlags, keyStr: String, modStrs: [String])] = [
    (.keyboardS,        .command,                            "s",  ["cmd"]),
    (.keyboardS,        [.command, .shift],                  "s",  ["cmd", "shift"]),
    (.keyboardGraveAccentAndTilde, .command,                 "`",  ["cmd"]),
    (.keyboardN,        .command,                            "n",  ["cmd"]),
    (.keyboardP,        .command,                            "p",  ["cmd"]),
    (.keyboardSlash,    .command,                            "/",  ["cmd"]),
  ]

  override func supportedEvents() -> [String]! { ["onShortcut"] }

  override class func requiresMainQueueSetup() -> Bool { true }

  override func constantsToExport() -> [AnyHashable: Any]! { [:] }

  @objc func buildKeyCommands() -> [UIKeyCommand] {
    return Self.supportedShortcuts.map { s in
      UIKeyCommand(
        input: String(UnicodeScalar(UInt8(s.key.rawValue))),
        modifierFlags: s.modifiers,
        action: #selector(handleKeyCommand(_:))
      )
    }
  }

  @objc private func handleKeyCommand(_ command: UIKeyCommand) {
    guard let match = Self.supportedShortcuts.first(where: {
      command.modifierFlags == $0.modifiers
    }) else { return }
    sendEvent(withName: "onShortcut", body: ["key": match.keyStr, "modifiers": match.modStrs])
  }
}
