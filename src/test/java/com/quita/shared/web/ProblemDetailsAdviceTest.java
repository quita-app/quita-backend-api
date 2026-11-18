package com.quita.shared.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

@WebMvcTest(controllers = ProbeController.class)
@AutoConfigureMockMvc(addFilters = false) // no security or request id filter: only the advice matters here
class ProblemDetailsAdviceTest {

  @Autowired
  MockMvcTester mvc;

  @Test
  void rejectsInvalidBodyWithFieldErrors() {
    MvcTestResult result = mvc.post()
        .uri("/probe/validation")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{}")
        .exchange();

    assertThat(result).hasStatus(400);
    assertThat(result).bodyJson().extractingPath("$.code").isEqualTo("VALIDATION_FAILED");
    assertThat(result).bodyJson().extractingPath("$.errors").asArray().hasSize(2);
  }

  @Test
  void rejectsMalformedBodyWithEmptyErrors() {
    MvcTestResult result = mvc.post()
        .uri("/probe/validation")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":")
        .exchange();

    assertThat(result).hasStatus(400);
    assertThat(result).bodyJson().extractingPath("$.code").isEqualTo("VALIDATION_FAILED");
    assertThat(result).bodyJson().extractingPath("$.errors").asArray().isEmpty();
  }

  @Test
  void mapsDomainExceptionToProblemDetails() {
    MvcTestResult result = mvc.get().uri("/probe/not-found").exchange();

    assertThat(result).hasStatus(404);
    assertThat(result).hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
    assertThat(result).bodyJson().extractingPath("$.code").isEqualTo("NOT_FOUND");
    assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo("Resource not found");
  }

  @Test
  void copiesDomainExceptionPropertiesToTheBody() {
    MvcTestResult result = mvc.get().uri("/probe/domain-with-properties").exchange();

    assertThat(result).hasStatus(429);
    assertThat(result).bodyJson().extractingPath("$.code").isEqualTo("PROBE_LIMIT");
    assertThat(result).bodyJson().extractingPath("$.retryAt").isEqualTo("2026-11-17T14:00:00Z");
  }

  @Test
  void hidesUnexpectedErrorMessage() {
    MvcTestResult result = mvc.get().uri("/probe/unexpected").exchange();

    assertThat(result).hasStatus(500);
    assertThat(result).bodyJson().extractingPath("$.code").isEqualTo("INTERNAL_ERROR");
    assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo("Unexpected error");
    assertThat(result).bodyText().doesNotContain("app_user");
  }

  @Test
  void mapsUnknownRouteToNotFound() {
    MvcTestResult result = mvc.get().uri("/probe/does-not-exist").exchange();

    assertThat(result).hasStatus(404);
    assertThat(result).bodyJson().extractingPath("$.code").isEqualTo("NOT_FOUND");
  }

  @Test
  void mapsUnsupportedMethodToUnsupportedRequest() {
    MvcTestResult result = mvc.delete().uri("/probe/not-found").exchange();

    assertThat(result).hasStatus(405);
    assertThat(result).bodyJson().extractingPath("$.code").isEqualTo("UNSUPPORTED_REQUEST");
  }
}
