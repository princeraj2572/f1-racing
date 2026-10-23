import { content } from '../content';
import { checkEmail } from '../email';

/** Notify-me form: validates the address and shows a message. Nothing is sent or stored. */
export function bindNotifyForm(form: HTMLFormElement): void {
  const copy = content.chapters.finale.form;
  const input = form.querySelector<HTMLInputElement>('input[type="email"]');
  const message = form.querySelector<HTMLElement>('.notify__msg');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!input || !message) return;

  const show = (kind: 'error' | 'success' | 'clear', text = ''): void => {
    message.textContent = text;
    message.classList.toggle('is-error', kind === 'error');
    message.classList.toggle('is-success', kind === 'success');
    input.setAttribute('aria-invalid', kind === 'error' ? 'true' : 'false');
  };

  input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true') show('clear');
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = checkEmail(input.value);
    if (!result.ok) {
      show('error', result.reason === 'empty' ? copy.errorEmpty : copy.errorInvalid);
      input.focus();
      return;
    }
    show('success', copy.success);
    input.value = '';
    if (button) button.disabled = true;
    window.setTimeout(() => {
      if (button) button.disabled = false;
    }, 3000);
  });
}
