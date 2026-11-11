package com.quita;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = "spring.flyway.enabled=true") // applies the migrations to the test database
class QuitaBackendApiApplicationTests {

	@Test
	void contextLoads() {
	}

}
