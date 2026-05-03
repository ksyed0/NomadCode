import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

const mockTheme = {
  bg: '#0F172A', bgElevated: '#1E293B', bgHighlight: '#334155',
  text: '#E2E8F0', textMuted: '#64748B', accent: '#0D9488',
  border: '#334155', error: '#EF4444',
};
jest.mock('../../src/theme/tokens', () => ({ useTheme: () => mockTheme }));

import ModelSearchSelector from '../../src/components/ModelSearchSelector';
import type { OpenRouterModel } from '../../src/ai/aiProvider';

const MODELS: OpenRouterModel[] = [
  {
    id: 'anthropic/claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    context_length: 200000,
    pricing: { prompt: '0.0000008', completion: '0.000004' },
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct:free',
    name: 'Llama 3.1 8B',
    context_length: 131072,
    pricing: { prompt: '0', completion: '0' },
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    context_length: 128000,
    pricing: { prompt: '0.000005', completion: '0.000015' },
  },
];

describe('ModelSearchSelector', () => {
  it('renders model names', () => {
    const { getByText } = render(
      <ModelSearchSelector
        models={MODELS}
        selectedModel="anthropic/claude-3-5-haiku"
        onSelect={jest.fn()}
        loading={false}
      />
    );
    expect(getByText('Claude 3.5 Haiku')).toBeTruthy();
    expect(getByText('Llama 3.1 8B')).toBeTruthy();
    expect(getByText('GPT-4o')).toBeTruthy();
  });

  it('filters models by search query', () => {
    const { getByPlaceholderText, queryByText } = render(
      <ModelSearchSelector
        models={MODELS}
        selectedModel="anthropic/claude-3-5-haiku"
        onSelect={jest.fn()}
        loading={false}
      />
    );
    fireEvent.changeText(getByPlaceholderText('Search models...'), 'claude');
    expect(queryByText('Claude 3.5 Haiku')).toBeTruthy();
    expect(queryByText('GPT-4o')).toBeNull();
  });

  it('shows FREE badge for free models', () => {
    const { getByText } = render(
      <ModelSearchSelector
        models={MODELS}
        selectedModel="anthropic/claude-3-5-haiku"
        onSelect={jest.fn()}
        loading={false}
      />
    );
    expect(getByText('FREE')).toBeTruthy();
  });

  it('calls onSelect when a model is tapped', () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <ModelSearchSelector
        models={MODELS}
        selectedModel="anthropic/claude-3-5-haiku"
        onSelect={onSelect}
        loading={false}
      />
    );
    fireEvent.press(getByText('Llama 3.1 8B'));
    expect(onSelect).toHaveBeenCalledWith('meta-llama/llama-3.1-8b-instruct:free');
  });

  it('shows loading spinner when loading=true', () => {
    const { getByTestId } = render(
      <ModelSearchSelector
        models={[]}
        selectedModel=""
        onSelect={jest.fn()}
        loading={true}
      />
    );
    expect(getByTestId('models-loading')).toBeTruthy();
  });

  it('does not call onSelect when disabled', () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <ModelSearchSelector
        models={MODELS}
        selectedModel=""
        onSelect={onSelect}
        loading={false}
        disabled={true}
      />
    );
    fireEvent.press(getByText('Claude 3.5 Haiku'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows empty state when no models match search', () => {
    const { getByPlaceholderText, queryByText } = render(
      <ModelSearchSelector
        models={MODELS}
        selectedModel=""
        onSelect={jest.fn()}
        loading={false}
      />
    );
    fireEvent.changeText(getByPlaceholderText('Search models...'), 'zzznomatch');
    expect(queryByText('Claude 3.5 Haiku')).toBeNull();
    expect(queryByText('GPT-4o')).toBeNull();
  });
});
