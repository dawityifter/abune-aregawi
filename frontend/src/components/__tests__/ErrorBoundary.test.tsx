import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary from '../ErrorBoundary';
import { en, ti } from '../../i18n/dictionaries';

/**
 * React.lazy() permanently caches a rejected factory on the component
 * reference, so once a chunk-load failure has been caught, simply clearing
 * ErrorBoundary's hasError state and re-rendering children throws the exact
 * same rejection again — the "Try Again" button was a no-op for this case.
 * These tests exercise the fix: a chunk-load error triggers a real reload,
 * while any other error still gets the cheap in-place retry.
 */

const ChunkLoadFailure: React.FC = () => {
  const error = new Error('Loading chunk 3 failed.');
  error.name = 'ChunkLoadError';
  throw error;
};

const originalLocation = window.location;

describe('ErrorBoundary', () => {
  let reloadSpy: jest.Mock;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    reloadSpy = jest.fn();
    // jsdom's window.location.reload throws "not implemented"; replace the
    // whole object for the duration of the test (its properties are
    // non-configurable individually, but `location` itself is).
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });
    // ErrorBoundary logs caught errors with console.error; silence that
    // expected noise so it doesn't clutter test output.
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    consoleErrorSpy.mockRestore();
  });

  it('reloads the page instead of re-rendering when the caught error is a chunk-load failure', () => {
    render(
      <ErrorBoundary>
        <ChunkLoadFailure />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Try Again'));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('clears the error and re-renders children in place for a non-chunk error', () => {
    let shouldThrow = true;
    const Flaky: React.FC = () => {
      if (shouldThrow) throw new Error('Something else broke');
      return <div>recovered</div>;
    };

    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByText('Try Again'));

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>all good</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  // The fallback is a class component reachable when other things (possibly
  // including I18nProvider itself) have already broken, so it reads the
  // persisted language directly out of localStorage rather than via
  // useI18n. These pin that it actually renders both languages' strings,
  // not just English by coincidence of the other tests' default jsdom state.
  describe('bilingual fallback copy', () => {
    const Boom: React.FC = () => {
      throw new Error('boom');
    };

    afterEach(() => {
      window.localStorage.clear();
    });

    it('renders the English fallback copy when app.lang is "en"', () => {
      window.localStorage.setItem('app.lang', 'en');
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      );
      expect(screen.getByText(en.errorBoundary.title)).toBeInTheDocument();
      expect(screen.getByText(en.errorBoundary.body)).toBeInTheDocument();
      expect(screen.getByText(en.errorBoundary.retry)).toBeInTheDocument();
    });

    it('renders the Tigrigna fallback copy when app.lang is "ti"', () => {
      window.localStorage.setItem('app.lang', 'ti');
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      );
      expect(screen.getByText(ti.errorBoundary.title)).toBeInTheDocument();
      expect(screen.getByText(ti.errorBoundary.body)).toBeInTheDocument();
      expect(screen.getByText(ti.errorBoundary.retry)).toBeInTheDocument();
    });

    it('falls back to English when localStorage throws (e.g. Safari private mode)', () => {
      const getItemSpy = jest
        .spyOn(window.localStorage.__proto__, 'getItem')
        .mockImplementation(() => {
          throw new Error('SecurityError');
        });

      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      );
      expect(screen.getByText(en.errorBoundary.title)).toBeInTheDocument();

      getItemSpy.mockRestore();
    });

    it('falls back to English when app.lang is unset', () => {
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      );
      expect(screen.getByText(en.errorBoundary.title)).toBeInTheDocument();
    });
  });
});
