import Foundation
import React

@objc(KeyboardShortcuts)
class KeyboardShortcuts: RCTEventEmitter {

  private static let supportedShortcuts: [(keyStr: String, modifiers: UIKeyModifierFlags, modStrs: [String])] = [
    ("s",  .command,            ["cmd"]),
    ("s",  [.command, .shift],  ["cmd", "shift"]),
    ("`",  .command,            ["cmd"]),
    ("n",  .command,            ["cmd"]),
    ("p",  .command,            ["cmd"]),
    ("/",  .command,            ["cmd"]),
  ]

  override func supportedEvents() -> [String]! { ["onShortcut"] }

  override class func requiresMainQueueSetup() -> Bool { true }

  @objc func buildKeyCommands() -> [UIKeyCommand] {
    return Self.supportedShortcuts.map { s in
      UIKeyCommand(
        input: s.keyStr,
        modifierFlags: s.modifiers,
        action: #selector(handleKeyCommand(_:))
      )
    }
  }

  @objc private func handleKeyCommand(_ command: UIKeyCommand) {
    guard let input = command.input,
          let match = Self.supportedShortcuts.first(where: {
            input == $0.keyStr && command.modifierFlags == $0.modifiers
          }) else { return }
    sendEvent(withName: "onShortcut", body: ["key": match.keyStr, "modifiers": match.modStrs])
  }
}
