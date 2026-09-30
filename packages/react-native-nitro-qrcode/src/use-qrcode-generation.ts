import { useEffect, useRef, useState } from "react";
import { toError, type QRCodeOptions } from "./validation";

export type QRCodeGenerationResult = {
  uri: string | undefined;
  displayedValue: string | undefined;
  pending: boolean;
  error: Error | undefined;
  options: QRCodeOptions;
};

export type QRCodeAsyncGenerator = {
  toPngDataUriAsync: (options: QRCodeOptions) => Promise<string>;
};

export function useQRCodeGeneration(
  options: QRCodeOptions,
  generators: QRCodeAsyncGenerator,
  keepPreviousImage: boolean,
  onReady: ((uri: string) => void) | undefined,
  onError: ((error: Error) => void) | undefined,
): QRCodeGenerationResult {
  const [result, setResult] = useState<{
    options: QRCodeOptions;
    uri: string;
  }>();
  const [generationError, setGenerationError] = useState<Error>();
  const [failedOptions, setFailedOptions] = useState<QRCodeOptions>();
  const generationId = useRef(0);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  }, [onError, onReady]);

  useEffect(() => {
    let isMounted = true;
    const request = ++generationId.current;
    void generators.toPngDataUriAsync(options).then(
      (nextUri) => {
        if (!isMounted || request !== generationId.current) {
          return;
        }
        setGenerationError(undefined);
        setResult({ options, uri: nextUri });
        onReadyRef.current?.(nextUri);
      },
      (error: unknown) => {
        if (!isMounted || request !== generationId.current) {
          return;
        }
        const nextError = toError(error);
        setFailedOptions(options);
        const onErrorCallback = onErrorRef.current;
        if (onErrorCallback === undefined) {
          setGenerationError(nextError);
          return;
        }
        onErrorCallback(nextError);
      },
    );

    return () => {
      isMounted = false;
    };
  }, [generators, options]);

  const isCurrent = result?.options === options;
  const uri = keepPreviousImage || isCurrent ? result?.uri : undefined;

  return {
    uri,
    displayedValue: uri === undefined ? undefined : result?.options.value,
    pending: !isCurrent && failedOptions !== options,
    error: generationError,
    options,
  };
}
