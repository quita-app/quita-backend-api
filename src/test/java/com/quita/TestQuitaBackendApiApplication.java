package com.quita;

import org.springframework.boot.SpringApplication;

public class TestQuitaBackendApiApplication {

	public static void main(String[] args) {
		SpringApplication.from(QuitaBackendApiApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
