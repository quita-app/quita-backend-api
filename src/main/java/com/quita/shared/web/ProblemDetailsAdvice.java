package com.quita.shared.web;

import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Turns every exception thrown by a controller into Problem Details (RFC 9457) with a stable {@code code}. */
@Slf4j
@RestControllerAdvice
class ProblemDetailsAdvice {

  @ExceptionHandler(DomainException.class)
  ProblemDetail handleDomain(DomainException exception) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(exception.getStatus(), exception.getMessage());
    problem.setProperty("code", exception.getCode());
    exception.getProperties().forEach(problem::setProperty);
    return problem;
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ProblemDetail handleValidation(MethodArgumentNotValidException exception) {
    List<Map<String, String>> errors = exception.getFieldErrors().stream()
        .map(error -> Map.of("field", error.getField(), "message", String.valueOf(error.getDefaultMessage())))
        .toList();
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Request body is invalid");
    problem.setProperty("code", "VALIDATION_FAILED");
    problem.setProperty("errors", errors);
    return problem;
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  ProblemDetail handleUnreadable(HttpMessageNotReadableException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Request body is missing or malformed");
    problem.setProperty("code", "VALIDATION_FAILED");
    problem.setProperty("errors", List.of());
    return problem;
  }

  @ExceptionHandler(Exception.class)
  ProblemDetail handleUnexpected(Exception exception) {
    // Errors Spring already classifies (unknown route, wrong method...) are client errors: keep their status, no error log
    if (exception instanceof ErrorResponse errorResponse) {
      ProblemDetail body = errorResponse.getBody();
      String code = switch (body.getStatus()) {
        case 400 -> "VALIDATION_FAILED";
        case 404 -> "NOT_FOUND";
        default -> "UNSUPPORTED_REQUEST";
      };
      body.setProperty("code", code);
      return body;
    }

    // Anything else is a bug: the stack trace goes to the log only, never to the client
    log.error("Unexpected error", exception);
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected error");
    problem.setProperty("code", "INTERNAL_ERROR");
    return problem;
  }
}
