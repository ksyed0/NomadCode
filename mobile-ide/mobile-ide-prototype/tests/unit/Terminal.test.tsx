/**
 * Unit tests — Terminal component
 *
 * Tests command parsing, output rendering, and keyboard submission.
 * Uses @testing-library/react-native for component rendering.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Clipboard } from 'react-native';
import { Terminal } from '../../src/components/Terminal';
import { FileSystemBridge } from '../../src/utils/FileSystemBridge';

jest.mock('../../src/utils/FileSystemBridge', () => ({
  FileSystemBridge: {
    listDirectory: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    deleteEntry: jest.fn(),
    documentDirectory: '/mock-docs/',
  },
}));

describe('Terminal', () => {
  // ---------------------------------------------------------------------------
  // Renders without crashing
  // ---------------------------------------------------------------------------

  it('renders initial welcome lines', () => {
    render(<Terminal workingDirectory="/project" />);
    expect(screen.getByText(/NomadCode Terminal/i)).toBeTruthy();
    expect(screen.getByText(/Working directory: \/project/i)).toBeTruthy();
  });

  it('renders the prompt character', () => {
    render(<Terminal />);
    expect(screen.getByText('$')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Command input
  // ---------------------------------------------------------------------------

  it('clears input after submitting a command', () => {
    render(<Terminal />);
    const input = screen.getByPlaceholderText(/Enter command/i);
    fireEvent.changeText(input, 'help');
    fireEvent(input, 'submitEditing');
    expect(input.props.value).toBe('');
  });

  it('echoes the submitted command in the output', () => {
    render(<Terminal />);
    const input = screen.getByPlaceholderText(/Enter command/i);
    fireEvent.changeText(input, 'help');
    fireEvent(input, 'submitEditing');
    expect(screen.getByText('$ help')).toBeTruthy();
  });

  it('does nothing when empty input is submitted', () => {
    render(<Terminal />);
    const input = screen.getByPlaceholderText(/Enter command/i);
    fireEvent(input, 'submitEditing');
    // Should not add an empty "$ " line — only welcome lines present
    const commandLines = screen.queryAllByText(/^\$ $/);
    expect(commandLines).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Built-in commands
  // ---------------------------------------------------------------------------

  it('"help" outputs available commands', () => {
    render(<Terminal />);
    const input = screen.getByPlaceholderText(/Enter command/i);
    fireEvent.changeText(input, 'help');
    fireEvent(input, 'submitEditing');
    expect(screen.getByText(/Available commands/i)).toBeTruthy();
  });

  it('"pwd" outputs the working directory', () => {
    render(<Terminal workingDirectory="/my/project" />);
    const input = screen.getByPlaceholderText(/Enter command/i);
    fireEvent.changeText(input, 'pwd');
    fireEvent(input, 'submitEditing');
    expect(screen.getByText('/my/project')).toBeTruthy();
  });

  it('"echo <text>" outputs the text', () => {
    render(<Terminal />);
    const input = screen.getByPlaceholderText(/Enter command/i);
    fireEvent.changeText(input, 'echo hello world');
    fireEvent(input, 'submitEditing');
    expect(screen.getByText('hello world')).toBeTruthy();
  });

  it('"clear" removes all output lines', () => {
    render(<Terminal />);
    const input = screen.getByPlaceholderText(/Enter command/i);
    fireEvent.changeText(input, 'clear');
    fireEvent(input, 'submitEditing');
    expect(screen.queryByText(/NomadCode Terminal/i)).toBeNull();
  });

  it('unknown command shows error message', () => {
    render(<Terminal />);
    const input = screen.getByPlaceholderText(/Enter command/i);
    fireEvent.changeText(input, 'foobar');
    fireEvent(input, 'submitEditing');
    expect(screen.getByText(/command not found/i)).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // onCommand callback
  // ---------------------------------------------------------------------------

  it('calls onCommand callback with the submitted command string', () => {
    const onCommand = jest.fn();
    render(<Terminal onCommand={onCommand} />);
    const input = screen.getByPlaceholderText(/Enter command/i);
    fireEvent.changeText(input, 'ls -la');
    fireEvent(input, 'submitEditing');
    expect(onCommand).toHaveBeenCalledWith('ls -la');
  });

  it('does not call onCommand for empty submissions', () => {
    const onCommand = jest.fn();
    render(<Terminal onCommand={onCommand} />);
    const input = screen.getByPlaceholderText(/Enter command/i);
    fireEvent(input, 'submitEditing');
    expect(onCommand).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// visible prop
// ---------------------------------------------------------------------------

describe('visible prop', () => {
  it('hides terminal content when visible=false', () => {
    render(<Terminal workingDirectory="/" visible={false} />);
    // display:none removes element from accessible host tree; use UNSAFE query
    const container = screen.UNSAFE_getByProps({ testID: 'terminal-container' });
    const flatStyle = [container.props.style].flat();
    expect(flatStyle).toContainEqual(expect.objectContaining({ display: 'none' }));
  });

  it('shows terminal content when visible=true', () => {
    render(<Terminal workingDirectory="/" visible={true} />);
    const container = screen.getByTestId('terminal-container');
    const flatStyle = [container.props.style].flat();
    const hasHidden = flatStyle.some((s: { display?: string } | null) => s?.display === 'none');
    expect(hasHidden).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ls command
// ---------------------------------------------------------------------------

describe('ls command', () => {
  beforeEach(() => {
    (FileSystemBridge.listDirectory as jest.Mock).mockResolvedValue([
      { name: 'App.tsx', path: '/project/App.tsx', isDirectory: false },
      { name: 'src', path: '/project/src', isDirectory: true },
    ]);
  });

  it('lists files from FileSystemBridge', async () => {
    render(<Terminal workingDirectory="/project" />);
    const input = screen.getByPlaceholderText('Enter command...');
    fireEvent.changeText(input, 'ls');
    fireEvent(input, 'submitEditing');
    await waitFor(() => {
      expect(screen.getByText('App.tsx')).toBeTruthy();
      expect(screen.getByText('src/')).toBeTruthy();
    });
  });

  it('shows error if listDirectory fails', async () => {
    (FileSystemBridge.listDirectory as jest.Mock).mockRejectedValue(new Error('No access'));
    render(<Terminal workingDirectory="/project" />);
    const input = screen.getByPlaceholderText('Enter command...');
    fireEvent.changeText(input, 'ls');
    fireEvent(input, 'submitEditing');
    await waitFor(() => {
      expect(screen.getByText(/ls: cannot access/)).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// cd command
// ---------------------------------------------------------------------------

describe('cd command', () => {
  it('updates working directory on cd', async () => {
    (FileSystemBridge.listDirectory as jest.Mock).mockResolvedValue([]);
    render(<Terminal workingDirectory="/home" />);
    const input = screen.getByPlaceholderText('Enter command...');

    fireEvent.changeText(input, 'cd /project');
    fireEvent(input, 'submitEditing');
    await waitFor(() => expect(screen.getByText('$ cd /project')).toBeTruthy());

    fireEvent.changeText(input, 'pwd');
    fireEvent(input, 'submitEditing');
    await waitFor(() => expect(screen.getByText('/project')).toBeTruthy());
  });

  it('shows error for cd with no argument', async () => {
    render(<Terminal workingDirectory="/home" />);
    const input = screen.getByPlaceholderText('Enter command...');
    fireEvent.changeText(input, 'cd');
    fireEvent(input, 'submitEditing');
    await waitFor(() => expect(screen.getByText(/cd: missing argument/)).toBeTruthy());
  });
});

// ---------------------------------------------------------------------------
// command history
// ---------------------------------------------------------------------------

describe('command history', () => {
  it('pressing history-up recalls previous command', async () => {
    (FileSystemBridge.listDirectory as jest.Mock).mockResolvedValue([]);
    render(<Terminal workingDirectory="/" />);
    const input = screen.getByPlaceholderText('Enter command...');

    fireEvent.changeText(input, 'pwd');
    fireEvent(input, 'submitEditing');
    await waitFor(() => expect(screen.getByText('$ pwd')).toBeTruthy());

    fireEvent.press(screen.getByTestId('history-up'));
    expect(input.props.value).toBe('pwd');
  });

  it('pressing history-down clears input when past end of history', async () => {
    (FileSystemBridge.listDirectory as jest.Mock).mockResolvedValue([]);
    render(<Terminal workingDirectory="/" />);
    const input = screen.getByPlaceholderText('Enter command...');

    fireEvent.changeText(input, 'pwd');
    fireEvent(input, 'submitEditing');
    await waitFor(() => expect(screen.getByText('$ pwd')).toBeTruthy());

    fireEvent.press(screen.getByTestId('history-up'));
    fireEvent.press(screen.getByTestId('history-down'));
    expect(input.props.value).toBe('');
  });
});

// ---------------------------------------------------------------------------
// long-press copy
// ---------------------------------------------------------------------------

describe('long-press copy', () => {
  it('long-pressing an output line copies its text to clipboard', async () => {
    const spy = jest.spyOn(Clipboard, 'setString').mockImplementation(() => {});
    render(<Terminal workingDirectory="/home" />);
    const input = screen.getByPlaceholderText('Enter command...');
    fireEvent.changeText(input, 'pwd');
    fireEvent(input, 'submitEditing');
    await waitFor(() => expect(screen.getByText('/home')).toBeTruthy());
    fireEvent(screen.getByText('/home'), 'longPress');
    expect(spy).toHaveBeenCalledWith('/home');
    spy.mockRestore();
  });
});
