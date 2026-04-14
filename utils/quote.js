const QUOTE_API = "https://korean-advice-open-api.vercel.app/api/advice";

/**
 * 한국어 명언 1개를 가져온다.
 * 실패 시 null 반환 (알람 발송은 계속 진행).
 * @returns {{ message: string, author: string, authorProfile: string } | null}
 */
async function fetchQuote(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(QUOTE_API, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error(
        `[quote] 명언 API 호출 실패 (${attempt}/${maxRetries}):`,
        error.message,
      );
      if (attempt === maxRetries) return null;
    }
  }
}

module.exports = { fetchQuote };
