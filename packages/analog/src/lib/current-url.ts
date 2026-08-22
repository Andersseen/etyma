import { DestroyRef, inject, signal, type Signal } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';

/**
 * The path currently on screen, as a signal, in the router's own address space.
 *
 * Seeded from `Location` rather than from `Router.url`, which is `/` until the first
 * navigation resolves - so metadata written during bootstrap would describe the site root
 * whatever page the visitor actually asked for. `Location` also strips the base href, so
 * the value means the same thing before and after a navigation in an application served
 * from a sub-path.
 *
 * The router is subscribed rather than adapted into an observable-flavoured API: the
 * subscription is an implementation detail and nothing RxJS-shaped escapes.
 */
export function injectCurrentUrl(): Signal<string> {
  const router = inject(Router);
  const location = inject(Location);
  const destroyRef = inject(DestroyRef);

  const current = signal(location.path(true));

  const subscription = router.events.subscribe(event => {
    if (event instanceof NavigationEnd) {
      current.set(event.urlAfterRedirects);
    }
  });

  destroyRef.onDestroy(() => {
    subscription.unsubscribe();
  });

  return current.asReadonly();
}
