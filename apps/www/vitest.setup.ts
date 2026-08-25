// Angular's partial declarations fall back to JIT compilation outside a linker-aware build,
// and JIT needs the compiler to have been loaded. Importing it here keeps any test that
// touches an Angular service working without each one having to remember.
import '@angular/compiler';
