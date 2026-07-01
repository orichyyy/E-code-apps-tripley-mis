export type ApiError = {
  code: string;
  message: string;
};

export type ApiResult<T> =
  | {
      ok: true;
      data: T;
      requestId: string;
    }
  | {
      ok: false;
      error: ApiError;
      requestId: string;
    };
