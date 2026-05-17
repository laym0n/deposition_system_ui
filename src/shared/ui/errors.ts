import { HttpError } from '@shared/api/fetchJson';
import { HttpTextError } from '@shared/api/fetchText';

export type UserFacingError = {
  title: string;
  description?: string;
};

function normalizeMessage(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function toUserFacingError(error: unknown): UserFacingError {
  // Default message should be safe and non-technical.
  const fallback: UserFacingError = {
    title: 'Не удалось выполнить запрос',
    description: 'Попробуйте ещё раз позже.',
  };

  if (!error) return fallback;

  // Prefer status-aware messages for our typed errors.
  if (error instanceof HttpError || error instanceof HttpTextError) {
    const status = error.status;
    if (status === 401) {
      return { title: 'Требуется вход', description: 'Пожалуйста, войдите в систему и повторите попытку.' };
    }
    if (status === 403) {
      return { title: 'Недостаточно прав', description: 'У вас нет доступа к этой операции.' };
    }
    if (status === 404) {
      return { title: 'Не найдено', description: 'Запрошенные данные не найдены.' };
    }
    if (status >= 500) {
      return { title: 'Ошибка сервера', description: 'Попробуйте ещё раз позже.' };
    }
    return { title: 'Ошибка запроса', description: 'Проверьте данные и повторите попытку.' };
  }

  // Generic Error: keep message only if it looks user-friendly.
  if (error instanceof Error) {
    const msg = normalizeMessage(error.message || '');
    // Filter out common technical prefixes.
    if (!msg) return fallback;
    const looksTechnical = /^(HTTP\s+\d+|AxiosError|NetworkError|TypeError:|Failed to fetch|fetch\(|Unexpected token)/i.test(msg);
    if (looksTechnical) return fallback;
    // If message is russian (or at least non-empty) - it's probably safe.
    return { title: 'Ошибка', description: msg };
  }

  // Fallback for string/unknown
  if (typeof error === 'string') {
    const msg = normalizeMessage(error);
    if (!msg) return fallback;
    return { title: 'Ошибка', description: msg };
  }

  return fallback;
}
