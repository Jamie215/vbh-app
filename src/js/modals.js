// Modal system - promise-based replacement for native alert() and confirm().
// Visual pattern matches the existing final-session and program-completion modals.
//
// Usage:
//   await showAlert({ title, message, variant, buttonText, icon })
//   const ok = await showConfirm({ title, message, variant, confirmText, cancelText, icon })
//
// Variants: 'info' (default) | 'danger' | 'success' | 'warning'
// Keys:     ESC dismisses (resolves false), Enter confirms (resolves true)
// Backdrop: alerts dismiss on click, confirms do NOT (prevents accidental cancel)
//
// Note: title/message accept HTML (matches the pattern used by alerts.js banners).
// Do not pass untrusted user input without escaping.

let _modalCounter = 0;

const _MODAL_VARIANTS = {
    info: {
        iconBg: 'linear-gradient(135deg, #667eea, #764ba2)',
        icon: 'fa-circle-info',
        primaryBg: 'linear-gradient(135deg, #667eea, #764ba2)',
        primaryShadow: 'rgba(102,126,234,0.3)'
    },
    danger: {
        iconBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
        icon: 'fa-triangle-exclamation',
        primaryBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
        primaryShadow: 'rgba(239,68,68,0.3)'
    },
    success: {
        iconBg: 'linear-gradient(135deg, #10b981, #059669)',
        icon: 'fa-circle-check',
        primaryBg: 'linear-gradient(135deg, #10b981, #059669)',
        primaryShadow: 'rgba(16,185,129,0.3)'
    },
    warning: {
        iconBg: 'linear-gradient(135deg, #f59e0b, #f97316)',
        icon: 'fa-triangle-exclamation',
        primaryBg: 'linear-gradient(135deg, #f59e0b, #f97316)',
        primaryShadow: 'rgba(245,158,11,0.3)'
    }
};

function _showModal({
    title,
    message,
    variant,
    icon,
    showCancel,
    confirmText,
    cancelText,
    allowBackdropDismiss
}) {
    return new Promise((resolve) => {
        const modalId = `app-modal-${++_modalCounter}`;
        const v = _MODAL_VARIANTS[variant] || _MODAL_VARIANTS.info;
        const displayIcon = icon || v.icon;
        const previouslyFocused = document.activeElement;

        const overlay = document.createElement('div');
        overlay.id = modalId;
        overlay.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] opacity-0 transition-opacity duration-300 p-4';

        const cancelBtnHTML = showCancel ? `
            <button type="button" class="py-3 px-6 bg-white text-text-secondary border-[1.5px] border-border-light rounded-lg text-base font-medium cursor-pointer transition-all hover:bg-subtle hover:border-border-medium" data-modal-action="cancel">${cancelText}</button>
        ` : '';

        overlay.innerHTML = `
            <div class="bg-white rounded-2xl p-8 max-w-[440px] w-full text-center scale-90 transition-transform duration-300" style="box-shadow: 0 20px 60px rgba(0,0,0,0.15);" role="dialog" aria-modal="true" aria-labelledby="${modalId}-title">
                <div class="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style="background: ${v.iconBg};">
                    <i class="fa-solid ${displayIcon} text-2xl text-white"></i>
                </div>
                <h2 id="${modalId}-title" class="text-xl font-bold text-text-primary mb-3">${title || ''}</h2>
                <p class="text-base text-[#4a5568] leading-relaxed mb-6">${message || ''}</p>
                <div class="flex justify-center gap-3">
                    ${cancelBtnHTML}
                    <button type="button" class="text-white border-none py-3 px-8 rounded-lg text-base font-semibold cursor-pointer transition-all hover:-translate-y-px" style="background: ${v.primaryBg};" onmouseenter="this.style.boxShadow='0 4px 12px ${v.primaryShadow}'" onmouseleave="this.style.boxShadow='none'" data-modal-action="confirm">${confirmText}</button>
                </div>
            </div>
        `;

        const appRoot = document.getElementById('app') || document.body;
        appRoot.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            const card = overlay.querySelector('div[role="dialog"]');
            if (card) card.style.transform = 'scale(1)';
        });

        const close = (result) => {
            overlay.style.opacity = '0';
            const card = overlay.querySelector('div[role="dialog"]');
            if (card) card.style.transform = 'scale(0.9)';
            document.removeEventListener('keydown', onKey);
            setTimeout(() => {
                overlay.remove();
                if (previouslyFocused && previouslyFocused.focus) {
                    try { previouslyFocused.focus(); } catch {}
                }
                resolve(result);
            }, 300);
        };

        overlay.querySelectorAll('[data-modal-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                close(btn.dataset.modalAction === 'confirm');
            });
        });

        if (allowBackdropDismiss) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(false);
            });
        }

        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); close(false); }
            else if (e.key === 'Enter') { e.preventDefault(); close(true); }
        };
        document.addEventListener('keydown', onKey);

        // Focus the primary button so Enter works immediately
        requestAnimationFrame(() => {
            const primaryBtn = overlay.querySelector('[data-modal-action="confirm"]');
            if (primaryBtn) primaryBtn.focus();
        });
    });
}

/**
 * Styled replacement for alert(). Resolves when dismissed.
 * @returns {Promise<void>}
 */
function showAlert({ title, message, variant = 'info', buttonText = 'OK', icon } = {}) {
    return _showModal({
        title, message, variant, icon,
        showCancel: false,
        confirmText: buttonText,
        allowBackdropDismiss: true
    });
}

/**
 * Styled replacement for confirm(). Resolves to true (confirm) or false (cancel/ESC).
 * @returns {Promise<boolean>}
 */
function showConfirm({ title, message, variant = 'info', confirmText = 'Confirm', cancelText = 'Cancel', icon } = {}) {
    return _showModal({
        title, message, variant, icon,
        showCancel: true,
        confirmText, cancelText,
        allowBackdropDismiss: false
    });
}

console.log('Modals module loaded');