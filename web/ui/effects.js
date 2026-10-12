// Presentation-only effects; business state is owned by feature controllers.
import { prefersReducedMotion } from '../core/experience.js';
export async function focusEffect(target) {
    if (!target?.isConnected)
        return;
    target.classList.add('focus-activating');
    target.setAttribute('aria-busy', 'true');
    await new Promise(resolve => setTimeout(resolve, prefersReducedMotion() ? 0 : 520));
}
export async function revertFocusEffect(target) {
    if (!target?.isConnected)
        return;
    target.classList.remove('focus-activating');
    target.classList.add('focus-reverting');
    await new Promise(resolve => setTimeout(resolve, prefersReducedMotion() ? 0 : 360));
    if (target.isConnected) {
        target.classList.remove('focus-reverting');
        target.removeAttribute('aria-busy');
    }
}
export async function playEffect(target, type, duration = 720) {
    target.classList.remove('effect-spin', 'effect-breakthrough', 'effect-success', 'effect-failure');
    target.classList.add(type === 'draw' ? 'effect-spin' : 'effect-breakthrough');
    await new Promise(resolve => setTimeout(resolve, prefersReducedMotion() ? 0 : duration));
    target.classList.remove('effect-spin', 'effect-breakthrough');
}
