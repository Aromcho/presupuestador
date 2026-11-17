import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

/** Traduce los errores de PostgreSQL a mensajes claros (duplicados, referencias) */
@Catch()
export class PgExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }
    const err = (exception as { cause?: unknown })?.cause ?? exception;
    const code = (err as { code?: string })?.code;
    if (code === '23505') {
      res.status(HttpStatus.CONFLICT).json({ statusCode: 409, message: 'Ya existe un registro con esos datos (por ejemplo, el mismo código en la misma marca).' });
      return;
    }
    if (code === '23503') {
      res.status(HttpStatus.CONFLICT).json({ statusCode: 409, message: 'No se puede: hay otros datos que dependen de este.' });
      return;
    }
    if (code === '22P02') {
      res.status(HttpStatus.BAD_REQUEST).json({ statusCode: 400, message: 'Algún dato no tiene el formato correcto.' });
      return;
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: 'Algo salió mal. Probá de nuevo en unos segundos.' });
  }
}
