package com.quita.shared.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestIdFilterTest {

  private final RequestIdFilter filter = new RequestIdFilter();

  /** Runs the filter and returns the MDC request id seen by the rest of the chain (what every log line gets). */
  private String run(MockHttpServletRequest request, MockHttpServletResponse response) throws Exception {
    AtomicReference<String> seenInChain = new AtomicReference<>();
    filter.doFilter(request, response, (req, res) -> seenInChain.set(MDC.get(RequestIdFilter.MDC_KEY)));
    return seenInChain.get();
  }

  @Test
  void keepsValidClientId() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.addHeader(RequestIdFilter.HEADER, "teste-123");
    MockHttpServletResponse response = new MockHttpServletResponse();

    String logged = run(request, response);

    assertThat(response.getHeader(RequestIdFilter.HEADER)).isEqualTo("teste-123");
    assertThat(logged).isEqualTo("teste-123");
  }

  @Test
  void replacesInvalidClientId() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.addHeader(RequestIdFilter.HEADER, "forged\nline");
    MockHttpServletResponse response = new MockHttpServletResponse();

    String logged = run(request, response);

    assertThat(response.getHeader(RequestIdFilter.HEADER)).isNotEqualTo("forged\nline").hasSize(36);
    assertThat(logged).isEqualTo(response.getHeader(RequestIdFilter.HEADER));
  }

  @Test
  void generatesIdWhenMissingAndClearsMdcAfterwards() throws Exception {
    MockHttpServletResponse response = new MockHttpServletResponse();

    String logged = run(new MockHttpServletRequest(), response);

    assertThat(logged).hasSize(36).isEqualTo(response.getHeader(RequestIdFilter.HEADER));
    assertThat(MDC.get(RequestIdFilter.MDC_KEY)).isNull();
  }
}
