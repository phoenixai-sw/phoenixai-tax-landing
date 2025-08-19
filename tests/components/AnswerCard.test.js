import React from 'react';
import { render, screen } from '@testing-library/react';
import AnswerCard from '../../components/AnswerCard';

describe('AnswerCard Component', () => {
  const mockProps = {
    title: '양도소득세 계산',
    content: '1주택 양도소득세는 다음과 같이 계산됩니다...',
    variant: 'primary'
  };

  test('renders title and content correctly', () => {
    render(<AnswerCard {...mockProps} />);
    
    expect(screen.getByText('양도소득세 계산')).toBeInTheDocument();
    expect(screen.getByText('1주택 양도소득세는 다음과 같이 계산됩니다...')).toBeInTheDocument();
  });

  test('shows loading state when isLoading is true', () => {
    render(<AnswerCard {...mockProps} isLoading={true} />);
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  test('applies correct variant class', () => {
    const { container } = render(<AnswerCard {...mockProps} variant="secondary" />);
    
    expect(container.firstChild).toHaveClass('bg-gray-100');
  });

  test('applies animation class when isActive is true', () => {
    const { container } = render(<AnswerCard {...mockProps} isActive={true} />);
    
    expect(container.firstChild).toHaveClass('animate-fadeInUp');
  });
});
