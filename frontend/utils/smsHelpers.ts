/**
 * SMS integration utilities for mobile web browsers
 */

/**
 * Waits for user to return to the browser tab
 * Uses Page Visibility API and focus events to detect return
 */
const waitForUserReturn = (): Promise<void> => {
  return new Promise((resolve) => {
    let resolved = false;

    const handleReturn = () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        // Resolve immediately to preserve user interaction context
        // No setTimeout - this ensures next confirm() is tied to user action
        resolve();
      }
    };

    const cleanup = () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', handleReturn);
      window.removeEventListener('pageshow', handleReturn);
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        handleReturn();
      }
    };

    // Listen for multiple events to catch user return
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', handleReturn);
    window.addEventListener('pageshow', handleReturn);

    // Fallback timeout after 60 seconds
    setTimeout(() => {
      if (!resolved) {
        handleReturn();
      }
    }, 60000);
  });
};

/**
 * Sends multiple SMS messages by opening them in sequence with user confirmation
 * Uses SMS URL scheme (sms:) for mobile browsers
 * Waits for user to return from SMS app before showing next confirmation
 * @param phoneNumbers - Array of phone numbers
 * @param message - Message text to send
 * @param memberNames - Optional array of member names to display in confirmation dialogs
 */
export const sendMultipleSMSMessages = async (
  phoneNumbers: string[],
  message: string,
  memberNames?: string[]
): Promise<void> => {
  let currentIndex = 0;

  const sendNextSMS = () => {
    if (currentIndex >= phoneNumbers.length) {
      // All messages sent
      window.alert(
        `✓ Tüm SMS işlemleri tamamlandı!\n\n` +
        `${phoneNumbers.length} kişi için SMS uygulaması açıldı.`
      );
      return;
    }

    const phoneNumber = phoneNumbers[currentIndex];
    const memberName = memberNames?.[currentIndex] || phoneNumber;
    const isLast = currentIndex === phoneNumbers.length - 1;

    // Show confirmation dialog for current member
    const confirmMessage = currentIndex === 0
      ? `${currentIndex + 1}/${phoneNumbers.length} - ${memberName} için SMS uygulaması açılacak.\n\n` +
        `📱 Numara: ${phoneNumber}\n\n` +
        `Telefonunuzda SMS uygulaması açılacak.\n` +
        `Lütfen mesajı gönderin ve tarayıcıya geri dönün.\n\n` +
        `Devam etmek istiyor musunuz?`
      : `${currentIndex + 1}/${phoneNumbers.length} - ${memberName} için SMS uygulaması açılacak.\n\n` +
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
      sendNextSMS();
      return;
    }

    try {
      // Create SMS URL with phone number and message
      const smsUrl = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;

      // Create a temporary link and click it programmatically
      // This is inside user interaction (confirm dialog) so no permission needed
      const link = document.createElement('a');
      link.href = smsUrl;
      link.style.display = 'none';
      document.body.appendChild(link);

      // Click the link to open SMS app
      link.click();

      // Remove the link immediately
      document.body.removeChild(link);

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

            // Continue with next SMS
            // Use small delay to let the page settle
            setTimeout(() => sendNextSMS(), 500);
          }
        };

        document.addEventListener('visibilitychange', handleReturn);
        window.addEventListener('focus', handleReturn);

        // Fallback: if user doesn't return in 60s, prompt anyway
        setTimeout(() => {
          document.removeEventListener('visibilitychange', handleReturn);
          window.removeEventListener('focus', handleReturn);
          sendNextSMS();
        }, 60000);
      }
    } catch (error) {
      console.error(`SMS error for ${memberName}:`, error);
      window.alert(
        `⚠️ SMS gönderilemedi!\n\n` +
        `${memberName} için SMS uygulaması açılamadı.\n\n` +
        `Hata: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`
      );
    }
  };

  // Start the chain
  sendNextSMS();
};

/**
 * Creates an SMS URL for a single recipient
 * @param phoneNumber - Phone number
 * @param message - Message text
 * @returns SMS URL string
 */
export const createSMSUrl = (phoneNumber: string, message: string): string => {
  return `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
};

/**
 * Validates if SMS sending is supported in the current browser
 * @returns true if SMS URL scheme is likely supported
 */
export const isSMSSupported = (): boolean => {
  // SMS URL scheme is generally supported on mobile browsers
  // Check if running on mobile device
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent.toLowerCase());
};
