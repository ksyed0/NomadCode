// Manual mock for react-native-document-picker (used in Jest tests).
// The real package wraps native UIDocumentPickerViewController (iOS)
// and the Android document picker — neither is available in Jest.

const DocumentPicker = {
  pickDirectory: jest.fn(),
  isCancel: jest.fn((err) => err && err.code === 'DOCUMENT_PICKER_CANCELED'),
};

module.exports = DocumentPicker;
module.exports.default = DocumentPicker;
