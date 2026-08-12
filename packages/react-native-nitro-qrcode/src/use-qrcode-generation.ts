import { useEffect, useRef, useState } from "react";
import { toError, type QRCodeOptions } from "./validation";

export type QRCodeGenerationResult = {
  uri: string | undefined;
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

  const uri =
    keepPreviousImage || result?.options === options
      ? result?.uri
      : undefined;

  return { uri, error: generationError, options };
}
