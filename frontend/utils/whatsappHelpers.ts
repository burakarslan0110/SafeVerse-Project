/**
 * WhatsApp Web and Desktop integration utilities
 */

/**
 * Cleans and formats a phone number for WhatsApp
 * @param phoneNumber - Phone number in any format
 * @returns Cleaned phone number without + prefix
 */
const cleanPhoneNumber = (phoneNumber: string): string => {
  // Remove all non-digit characters except + at the start
  let cleanedNumber = phoneNumber.replace(/[^\d+]/g, '');

  // If number starts with 0, replace with +90 (Turkey)
  if (cleanedNumber.startsWith('0')) {
    cleanedNumber = '+90' + cleanedNumber.substring(1);
  }

  // If number doesn't start with +, add +90 (Turkey)
  if (!cleanedNumber.startsWith('+')) {
    cleanedNumber = '+90' + cleanedNumber;
  }

  // Remove the + for WhatsApp API
  cleanedNumber = cleanedNumber.replace('+', '');

  return cleanedNumber;
};

/**
 * Creates a WhatsApp Desktop URL for sending a message
 * @param phoneNumber - Phone number in international format (e.g., +905551234567)
 * @param message - Message text to send
 * @returns WhatsApp Desktop URL (whatsapp://)
 */
export const createWhatsAppDesktopURL = (phoneNumber: string, message: string): string => {
  const cleanedNumber = cleanPhoneNumber(phoneNumber);
  const encodedMessage = encodeURIComponent(message);

  // WhatsApp Desktop URL format: whatsapp://send?phone=PHONE&text=MESSAGE
  return `whatsapp://send?phone=${cleanedNumber}&text=${encodedMessage}`;
};

/**
 * Creates a WhatsApp Web URL for sending a message
 * @param phoneNumber - Phone number in international format (e.g., +905551234567)
 * @param message - Message text to send
 * @returns WhatsApp Web URL
 */
export const createWhatsAppWebURL = (phoneNumber: string, message: string): string => {
  const cleanedNumber = cleanPhoneNumber(phoneNumber);
  const encodedMessage = encodeURIComponent(message);

  // WhatsApp Web URL format: https://web.whatsapp.com/send?phone=PHONE&text=MESSAGE
  return `https://web.whatsapp.com/send?phone=${cleanedNumber}&text=${encodedMessage}`;
};

/**
 * Opens WhatsApp Web (browser only, does not trigger desktop app)
 * @param phoneNumber - Phone number in international format
 * @param message - Message text to send
 * @returns Promise that resolves when opening is attempted
 */
export const openWhatsApp = async (phoneNumber: string, message: string): Promise<void> => {
  const webURL = createWhatsAppWebURL(phoneNumber, message);

  // Open WhatsApp Web directly in browser (no desktop app triggering)
  window.open(webURL, '_blank');
};

/**
 * Opens WhatsApp Web in a new window/tab with a pre-filled message
 * @param phoneNumber - Phone number in international format
 * @param message - Message text to send
 */
export const openWhatsAppWeb = (phoneNumber: string, message: string): void => {
  const url = createWhatsAppWebURL(phoneNumber, message);
  window.open(url, '_blank');
};

/**
 * Sends multiple WhatsApp messages by opening them in sequence with user confirmation
 * Opens WhatsApp Web in browser (does not trigger desktop app)
 * @param phoneNumbers - Array of phone numbers
 * @param message - Message text to send
 * @param memberNames - Optional array of member names to display in confirmation dialogs
 * @param delayMs - Delay between opening each WhatsApp window (default: 2000ms)
 */
export const sendMultipleWhatsAppMessages = async (
  phoneNumbers: string[],
  message: string,
  memberNames?: string[],
  delayMs: number = 1000
): Promise<void> => {
  let currentIndex = 0;

  const sendNextWhatsApp = () => {
    if (currentIndex >= phoneNumbers.length) {
      // All messages sent
      window.alert(
        `✓ Tüm WhatsApp mesajları tamamlandı!\n\n` +
        `${phoneNumbers.length} kişi için WhatsApp Web açıldı.`
      );
      return;
    }

    const phoneNumber = phoneNumbers[currentIndex];
    const memberName = memberNames?.[currentIndex] || phoneNumber;
    const isLast = currentIndex === phoneNumbers.length - 1;

    // Show confirmation dialog for current member
    const confirmMessage = currentIndex === 0
      ? `${currentIndex + 1}/${phoneNumbers.length} - ${memberName} için WhatsApp Web açılacak.\n\n` +
        `📱 Numara: ${phoneNumber}\n\n` +
        `Tarayıcıda yeni sekmede WhatsApp Web açılacak.\n` +
        `Lütfen mesajı gönderin ve bu pencereye geri dönün.\n\n` +
        `Devam etmek istiyor musunuz?`
      : `${currentIndex + 1}/${phoneNumbers.length} - ${memberName} için WhatsApp Web açılacak.\n\n` +
        `📱 Numara: ${phoneNumber}\n\n` +
        `Devam etmek için "Tamam"a basın.`;

    const confirmed = window.confirm(confirmMessage);

    if (!confirmed) {
      const skipAll = window.confirm(
        `${memberName} için gönderim iptal edildi.\n\n` +
        `Kalan ${phoneNumbers.length - currentIndex - 1} kişi için de iptal etmek istiyor musunuz?`
      );

      if (skipAll) {
        return;
      }
      // Skip this one, go to next
      currentIndex++;
      sendNextWhatsApp();
      return;
    }

    // Open WhatsApp Web (browser only, no desktop app)
    // This is inside user interaction (confirm dialog) so popup won't be blocked
    const webURL = createWhatsAppWebURL(phoneNumber, message);
    const newWindow = window.open(webURL, '_blank');

    // Check if popup was blocked
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      console.error('Popup blocked for', memberName);
      window.alert(
        `⚠️ Popup engelleyici tespit edildi!\n\n` +
        `${memberName} için WhatsApp açılamadı.\n\n` +
        `Lütfen tarayıcınızın popup engelleyicisini devre dışı bırakın ve tekrar deneyin.`
      );
      return;
    }

    // Move to next person
    currentIndex++;

    // If not the last one, wait for user to return
    if (!isLast) {
      // Set up listener for user return
      const handleReturn = () => {
        if (!document.hidden) {
          // Remove listeners
          document.removeEventListener('visibilitychange', handleReturn);
          window.removeEventListener('focus', handleReturn);

          // Continue with next WhatsApp
          // Use small delay to let the page settle
          setTimeout(() => sendNextWhatsApp(), 500);
        }
      };

      document.addEventListener('visibilitychange', handleReturn);
      window.addEventListener('focus', handleReturn);

      // Fallback: if user doesn't return in 60s, prompt anyway
      setTimeout(() => {
        document.removeEventListener('visibilitychange', handleReturn);
        window.removeEventListener('focus', handleReturn);
        sendNextWhatsApp();
      }, 60000);
    }
  };

  // Start the chain
  sendNextWhatsApp();
};

/**
 * Validates if a phone number can be used with WhatsApp
 * @param phoneNumber - Phone number to validate
 * @returns true if valid, false otherwise
 */
export const isValidWhatsAppNumber = (phoneNumber: string): boolean => {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');

  // Valid phone number should have at least 10 digits
  return digits.length >= 10;
};
