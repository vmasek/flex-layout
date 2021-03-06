/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {Injectable} from '@angular/core';
import {Observable, PartialObserver, Subscribable, Subscription} from 'rxjs';
import {filter, map} from 'rxjs/operators';

import {BreakPointRegistry} from '../breakpoints/break-point-registry';
import {MediaChange} from '../media-change';
import {MatchMedia} from '../match-media/match-media';
import {mergeAlias} from '../add-alias';
import {BreakPoint} from '../breakpoints/break-point';

/**
 * Base class for MediaService and pseudo-token for
 * @deprecated use MediaObserver instead
 * @deletion-target v7.0.0-beta.21
 */
export abstract class ObservableMedia implements Subscribable<MediaChange> {
  abstract isActive(query: string): boolean;

  abstract asObservable(): Observable<MediaChange>;

  abstract subscribe(next?: (value: MediaChange) => void,
                     error?: (error: any) => void,
                     complete?: () => void): Subscription;
  abstract subscribe(observer?: PartialObserver<MediaChange>): Subscription;
}

/**
 * Class internalizes a MatchMedia service and exposes an Subscribable and Observable interface.

 * This an Observable with that exposes a feature to subscribe to mediaQuery
 * changes and a validator method (`isActive(<alias>)`) to test if a mediaQuery (or alias) is
 * currently active.
 *
 * !! Only mediaChange activations (not de-activations) are announced by the ObservableMedia
 *
 * This class uses the BreakPoint Registry to inject alias information into the raw MediaChange
 * notification. For custom mediaQuery notifications, alias information will not be injected and
 * those fields will be ''.
 *
 * !! This is not an actual Observable. It is a wrapper of an Observable used to publish additional
 * methods like `isActive(<alias>). To access the Observable and use RxJS operators, use
 * `.asObservable()` with syntax like media.asObservable().map(....).
 *
 *  @usage
 *
 *  // RxJS
 *  import {filter} from 'rxjs/operators/filter';
 *  import { ObservableMedia } from '@angular/flex-layout';
 *
 *  @Component({ ... })
 *  export class AppComponent {
 *    status : string = '';
 *
 *    constructor(  media:ObservableMedia ) {
 *      let onChange = (change:MediaChange) => {
 *        this.status = change ? `'${change.mqAlias}' = (${change.mediaQuery})` : '';
 *      };
 *
 *      // Subscribe directly or access observable to use filter/map operators
 *      // e.g.
 *      //      media.subscribe(onChange);
 *
 *      media.asObservable()
 *        .pipe(
 *          filter((change:MediaChange) => true)   // silly noop filter
 *        ).subscribe(onChange);
 *    }
 *  }
 *  @deprecated use MediaObserver instead
 *  @deletion-target v7.0.0-beta.21
 */
@Injectable({providedIn: 'root'})
export class MediaService implements ObservableMedia {
  /**
   * Should we announce gt-<xxx> breakpoint activations ?
   */
  filterOverlaps = true;

  constructor(private breakpoints: BreakPointRegistry,
              private mediaWatcher: MatchMedia) {
    this._registerBreakPoints();
    this.observable$ = this._buildObservable();
  }

  /**
   * Test if specified query/alias is active.
   */
  isActive(alias: string): boolean {
    return this.mediaWatcher.isActive(this._toMediaQuery(alias));
  }

  /**
   * Proxy to the Observable subscribe method
   */
  subscribe(observerOrNext?: PartialObserver<MediaChange> | ((value: MediaChange) => void),
            error?: (error: any) => void,
            complete?: () => void): Subscription {
    if (observerOrNext) {
      if (typeof observerOrNext === 'object') {
        return this.observable$.subscribe(observerOrNext.next, observerOrNext.error,
          observerOrNext.complete);
      }
    }

    return this.observable$.subscribe(observerOrNext, error, complete);
  }

  /**
   * Access to observable for use with operators like
   * .filter(), .map(), etc.
   */
  asObservable(): Observable<MediaChange> {
    return this.observable$;
  }

  // ************************************************
  // Internal Methods
  // ************************************************

  /**
   * Register all the mediaQueries registered in the BreakPointRegistry
   * This is needed so subscribers can be auto-notified of all standard, registered
   * mediaQuery activations
   */
  private _registerBreakPoints() {
    const queries = this.breakpoints.sortedItems.map(bp => bp.mediaQuery);
    this.mediaWatcher.registerQuery(queries);
  }

  /**
   * Prepare internal observable
   *
   * NOTE: the raw MediaChange events [from MatchMedia] do not
   *       contain important alias information; as such this info
   *       must be injected into the MediaChange
   */
  private _buildObservable() {
    const excludeOverlaps = (change: MediaChange) => {
      const bp = this.breakpoints.findByQuery(change.mediaQuery);
      return !bp ? true : !(this.filterOverlaps && bp.overlapping);
    };

    /**
     * Only pass/announce activations (not de-activations)
     * Inject associated (if any) alias information into the MediaChange event
     * Exclude mediaQuery activations for overlapping mQs. List bounded mQ ranges only
     */
    return this.mediaWatcher.observe().pipe(
      filter(change => change.matches),
      filter(excludeOverlaps),
      map((change: MediaChange) =>
        mergeAlias(change, this._findByQuery(change.mediaQuery)))
    );
  }

  /**
   * Breakpoint locator by alias
   */
  private _findByAlias(alias: string) {
    return this.breakpoints.findByAlias(alias);
  }

  /**
   * Breakpoint locator by mediaQuery
   */
  private _findByQuery(query: string) {
    return this.breakpoints.findByQuery(query);
  }

  /**
   * Find associated breakpoint (if any)
   */
  private _toMediaQuery(query: string) {
    const bp: BreakPoint | null = this._findByAlias(query) || this._findByQuery(query);
    return bp ? bp.mediaQuery : query;
  }

  private readonly observable$: Observable<MediaChange>;
}

/**
 * @deprecated
 * @deletion-target v7.0.0-beta.21
 */
export const ObservableMediaProvider = { // tslint:disable-line:variable-name
  provide: ObservableMedia,
  useClass: MediaService
};
