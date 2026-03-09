/**
 * Unit tests — Terminal component
 *
 * Tests command parsing, output rendering, and keyboard submission.
 * Uses @testing-library/react-native for component rendering.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Terminal } from '../../src/components/Terminal';

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
