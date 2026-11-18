package com.quita.shared.web;

import java.util.Map;
import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Base of every business error. A use case throws a subclass; {@link ProblemDetailsAdvice} turns it
 * into an HTTP response. The {@code code} is the stable contract for clients; the detail is for humans.
 */
@Getter
public abstract class DomainException extends RuntimeException {

  private final String code;
  private final HttpStatus status;
  private final Map<String, Object> properties;

  protected DomainException(String code, HttpStatus status, String detail) {
    this(code, status, detail, Map.of());
  }

  protected DomainException(String code, HttpStatus status, String detail, Map<String, Object> properties) {
    super(detail);
    this.code = code;
    this.status = status;
    this.properties = properties;
  }
}
