package com.quita.shared.web;

import org.springframework.http.HttpStatus;

public class NotFoundException extends DomainException {

  public NotFoundException() {
    super("NOT_FOUND", HttpStatus.NOT_FOUND, "Resource not found");
  }
}
