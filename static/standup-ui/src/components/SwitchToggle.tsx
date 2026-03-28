import React from "react";

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string;
  "aria-label"?: string;
};

function SwitchToggle({ checked, onChange, id, "aria-label": ariaLabel }: Props) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`switch-toggle ${checked ? "switch-toggle--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-toggle__thumb" />
    </button>
  );
}

export default SwitchToggle;
