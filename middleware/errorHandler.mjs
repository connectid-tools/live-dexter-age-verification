import createError from 'http-errors';

export function notFoundHandler(req, res, next) {
  next(createError(404));
}

export function errorHandler(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500).json({ error: err.message });
}