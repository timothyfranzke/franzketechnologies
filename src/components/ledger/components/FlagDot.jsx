// Flag color palette: index stored on the flag, actual colors themed in CSS
// (.flag-dot--N has light and dark values) so dots stay legible in both modes.
export const FLAG_COLOR_COUNT = 6;
export const FLAG_COLOR_NAMES = ['Blue', 'Green', 'Amber', 'Purple', 'Pink', 'Teal'];

export default function FlagDot({ color = 0, size }) {
  return (
    <span
      className={`flag-dot flag-dot--${color % FLAG_COLOR_COUNT}`}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden="true"
    />
  );
}
