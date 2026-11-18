package com.quita.shared.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Test-only endpoints that trigger each kind of error handled by {@link ProblemDetailsAdvice}. */
@RestController
class ProbeController {

  record ProbeRequest(@NotBlank String name, @NotBlank String email) {}

  static class ProbeLimitException extends DomainException {
    ProbeLimitException() {
      super("PROBE_LIMIT", HttpStatus.TOO_MANY_REQUESTS, "Too many probes", Map.of("retryAt", "2026-11-17T14:00:00Z"));
    }
  }

  @PostMapping("/probe/validation")
  void validation(@Valid @RequestBody ProbeRequest request) {
  }

  @GetMapping("/probe/not-found")
  void notFound() {
    throw new NotFoundException();
  }

  @GetMapping("/probe/domain-with-properties")
  void domainWithProperties() {
    throw new ProbeLimitException();
  }

  @GetMapping("/probe/unexpected")
  void unexpected() {
    throw new IllegalStateException("select * from identity.app_user failed");
  }
}
