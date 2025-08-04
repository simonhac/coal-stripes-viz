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



the constructor for an event should take a session, phase, message
it should interrogate the session for its session number and the sequence number, as well as the elapsedMs ans deltaMs. all are required.



: number,
        24 +      data: MoveEventData