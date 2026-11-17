/**
 * Shared: shared kernel without business rules (money, tenant, web, time).
 * Open module: every module may use any of its packages.
 */
@ApplicationModule(type = ApplicationModule.Type.OPEN)
package com.quita.shared;

import org.springframework.modulith.ApplicationModule;