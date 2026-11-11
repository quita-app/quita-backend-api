package com.quita;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModularityTests {

    private final ApplicationModules modules = ApplicationModules.of(QuitaBackendApiApplication.class);

    @Test
    void verifiesModuleBoundaries() {
        modules.verify();
    }

    @Test
    void printsModules() {
        modules.forEach(System.out::println);
    }
}
