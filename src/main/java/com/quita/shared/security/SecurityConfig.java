package com.quita.shared.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration // "esta classe declara beans"
class SecurityConfig {

  @Bean
    // o Spring chama este método na subida e usa a corrente de filtros que ele devolve
  SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    return http
        .authorizeHttpRequests(auth -> auth
            // o health (e /liveness, /readiness) é público: o Render e os fronts não têm login
            .requestMatchers(HttpMethod.GET, "/actuator/health/**").permitAll()
            // o contrato da API: só existe no perfil local (springdoc desligado no padrão)
            .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
            // todo o resto é negado, até a F02 trazer o login
            .anyRequest().denyAll())
        .build();

  }
}