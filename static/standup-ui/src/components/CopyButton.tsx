import React, { useState, useCallback } from "react";
import Button from "@atlaskit/button/standard-button";

type Props = {
  text: string;
  label?: string;
};

function CopyButton({ text, label = "Copy" }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <Button appearance="default" onClick={handleCopy}>
      {copied ? "Copied!" : label}
    </Button>
  );
}

export default CopyButton;
