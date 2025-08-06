log retries

handle retry errors

find out why we can't go back before 2006

page for remote cache

touch tweaks — don't update tootip on vertical scroll
click on date range to zoom to today


not preloaing any more 


let's start by building a simple WheelFilter. it simply consumes wheel events and fires off a new        │
│   identical event that will be picked useWheelDragNonPassive      





⚡ Wheel 1.80 @ 0.5s 
{deltaX: -1.2, accumulatedX: 177, timeSinceStart: 7}
accumulatedX
: 
177
deltaX
: 
-1.2
timeSinceStart
: 
7
[[Prototype]]
: 
Object

simplify to:



 // Format the event header
  protected getHeader(): string {
    return `%c${this.phase} s${this.session.getSeq()}.e${this.eventSeq}@${this.elapsedMs}ms:`;
  }






in CapFacXAxisProps i often see bad data for future months. eg. september 2025 has no data, so the capacity factor should be null, but instead i'm seeing it painted in grey.

please write some debugging to print the capacity factor array for 2025 just after it is created by buildMonthlyCapacityFactorsForEachRegion in caf-fac-year.



 it is loaded by test to ensure that regionCapacityFactors is re




calculateRegionStats


I want to make a preview tile in OpenGraph specificiations:

Take a screenshot of stripes.energy with puppeteer, from the top of the page down to just below the NSW region section and save it in an appropriate locatoin for a preview tile.

Integrate it into the app.




@SessionManager.ts manages high resolution data for multiple kinds of events, grouped into sessions for each type of event.

Most of the time there'll be no sessions active, but when a session is active, only one of that type of session will be active. This is to be enforced.

We are introducing the concept of a MasterSession that "binds" contemperaneous event sessions together. There is only one MasterSession running at a time. The MasterSession will keep a collection of all sessions that have been bound to it.

When a new event session is created, if there is no current MasterSession, then one is created and the new session is created with a link to the MasterSession.



 one and ensure that the two objects 
 go from 0 -> 1 sessions active, a MasterSession object will be created and the 
Any new sessions created 



 add a MasterSession object which has:
* start time
* session number

when a session is created with SessionManager if there is no active MasterSession 