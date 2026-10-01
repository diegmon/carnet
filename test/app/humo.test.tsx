// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/preact';

afterEach(cleanup);

describe('herramientas', () => {
  it('renderiza Preact con JSX en jsdom', () => {
    render(<p>Carnet de Atención listo</p>);
    expect(screen.getByText('Carnet de Atención listo')).toBeTruthy();
  });
});
