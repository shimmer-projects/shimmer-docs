# java AQS的实现原理（大部分同步类都依赖AQS实现）



谈到并发，不得不谈`ReentrantLock`；而谈到`ReentrantLock`，不得不谈**AbstractQueuedSynchronized（AQS）！**,类如其名，抽象的队列式的同步器，**AQS定义了一套多线程访问共享资源的同步器框架，许多同步类实现都依赖于它，如常用的ReentrantLock/Semaphore/CountDownLatch...。**我们以ReentrantLock作为讲解切入点。

#### 1. ReentrantLock的调用过程

ReentrantLock把所有Lock接口的操作都委派到一个Sync类上，该类继承了AbstractQueuedSynchronizer：



```dart
static abstract class Sync extends AbstractQueuedSynchronizer  
```

Sync又有两个子类：



```dart
final static class NonfairSync extends Sync  
final static class FairSync extends Sync  
```

显然是为了支持**公平锁和非公平锁**而定义，默认情况下为非公平锁。
**先理一下Reentrant.lock()方法的调用过程（默认非公平锁）**：

![img](https://upload-images.jianshu.io/upload_images/6073827-3fc1aeb48d51684e.gif?imageMogr2/auto-orient/strip|imageView2/2/w/657/format/webp)

0_13119022769n5R.gif



#### 2. 锁实现（加锁）

> 简单说来，**AbstractQueuedSynchronizer会把所有的请求线程构成一个CLH队列，当一个线程执行完毕（lock.unlock()）时会激活自己的后继节点，但正在执行的线程并不在队列中，而那些等待执行的线程全部处于阻塞状态.**

线程的显式阻塞是通过调用**LockSupport.park()**完成，而LockSupport.park()则调用**sun.misc.Unsafe.park()**本地方法，再进一步，HotSpot在Linux中中通过调用**pthread_mutex_lock**函数把线程交给系统内核进行阻塞。该队列如图：

![img](https://upload-images.jianshu.io/upload_images/6073827-3d29c971eb71027b.gif?imageMogr2/auto-orient/strip|imageView2/2/w/517/format/webp)

0_1311847049xnXb.gif


与synchronized相同的是，这也是一个虚拟队列，不存在队列实例，仅存在节点之间的前后关系。**令人疑惑的是为什么采用CLH队列呢？原生的CLH队列是用于自旋锁，但Doug Lea把其改造为阻塞锁。**



> 当有线程竞争锁时，**该线程会首先尝试获得锁**，这对于那些已经在队列中排队的线程来说显得不公平，**这是非公平锁的由来之一**，与synchronized实现类似，这样会极大提高吞吐量。
> 如果已经存在Running线程，则新的竞争线程会被追加到队尾，具体是采用**基于CAS的Lock-Free算法**，因为线程并发对Tail调用CAS可能会导致其他线程CAS失败，解决办法是循环CAS直至成功。

**AbstractQueuedSynchronizer的实现非常精巧，令人叹为观止，不入细节难以完全领会其精髓**，下面详细说明实现过程：

**2.1 Sync.nonfairTryAcquire**
**nonfairTryAcquire**方法将是lock方法间接调用的第一个方法，每次请求锁时都会**首先调用该方法。**



```java
final boolean nonfairTryAcquire(int acquires) {  
    final Thread current = Thread.currentThread();  
    int c = getState();  
    if (c == 0) {  
        if (compareAndSetState(0, acquires)) {  
            setExclusiveOwnerThread(current);  
            return true;  
        }  
    }  
    else if (current == getExclusiveOwnerThread()) {  
        int nextc = c + acquires;  
        if (nextc < 0) // overflow  
            throw new Error("Maximum lock count exceeded");  
        setState(nextc);  
        return true;  
    }  
    return false;  
}  
```

> 1.该方法会首先判断当前状态，**如果c==0说明没有线程正在竞争该锁，如果不c !=0 说明有线程正拥有了该锁。**
> 2.**如果发现c==0，则通过CAS设置该状态值为acquires,acquires的初始调用值为1，每次线程重入该锁都会+1，每次unlock都会-1，但为0时释放锁。**如果CAS设置成功，则可以预计其他任何线程调用CAS都不会再成功，也就认为当前线程得到了该锁，也作为Running线程，**很显然这个Running线程并未进入等待队列。**
> 3.**如果c !=0 但发现自己已经拥有锁，**只是简单地++acquires，并修改status值，但因为没有竞争，所以通过setStatus修改，而非CAS，**也就是说这段代码实现了偏向锁的功能，并且实现的非常漂亮。**

**2.2 AbstractQueuedSynchronizer.addWaiter**

**addWaiter**方法负责把当前无法获得锁的线程**包装为一个Node**添加到队尾：



```csharp
private Node addWaiter(Node mode) {  
    Node node = new Node(Thread.currentThread(), mode);  
    // Try the fast path of enq; backup to full enq on failure  
    Node pred = tail;  
    if (pred != null) {  
        node.prev = pred;  
        if (compareAndSetTail(pred, node)) {  
            pred.next = node;  
            return node;  
        }  
    }  
    enq(node);  
    return node;  
}  
```

> **其中参数mode是独占锁还是共享锁，默认为null，独占锁**。追加到队尾的动作分两步：
> 1.**如果当前队尾已经存在(tail!=null)，则使用CAS把当前线程更新为Tail
> 2.如果当前Tail为null或则线程调用CAS设置队尾失败，则通过enq方法继续设置Tail**

**下面是enq方法：**



```java
private Node enq(final Node node) {  
    for (;;) {  
        Node t = tail;  
        if (t == null) { // Must initialize  
            Node h = new Node(); // Dummy header  
            h.next = node;  
            node.prev = h;  
            if (compareAndSetHead(h)) {  
                tail = node;  
                return h;  
            }  
        }  
        else {  
            node.prev = t;  
            if (compareAndSetTail(t, node)) {  
                t.next = node;  
                return t;  
            }  
        }  
    }  
}  
```

该方法就是循环调用CAS，即使有高并发的场景，无限循环将会最终成功把当前线程追加到队尾（或设置队头）。**总而言之，addWaiter的目的就是通过CAS把当前现在追加到队尾，并返回包装后的Node实例。**
把线程要包装为Node对象的主要原因，**除了用Node构造供虚拟队列外，还用Node包装了各种线程状态**，这些状态被精心设计为一些数字值：

> - **SIGNAL(-1) ：线程的后继线程正/已被阻塞，当该线程release或cancel时要重新这个后继线程(unpark)**
> - **CANCELLED(1)：因为超时或中断，该线程已经被取消**
> - **CONDITION(-2)：表明该线程被处于条件队列，就是因为调用了>- Condition.await而被阻塞**
> - **PROPAGATE(-3)：传播共享锁**
> - **0：0代表无状态**

**2.3 AbstractQueuedSynchronizer.acquireQueued**
**acquireQueued**的主要作用是把已经追加到队列的线程节点（addWaiter方法返回值）进行阻塞，**但阻塞前又通过tryAccquire重试是否能获得锁，如果重试成功能则无需阻塞**，**这里是非公平锁的由来之二**



```java
final boolean acquireQueued(final Node node, int arg) {  
    try {  
        boolean interrupted = false;  
        for (;;) {  
            final Node p = node.predecessor();  
            if (p == head && tryAcquire(arg)) {  
                setHead(node);  
                p.next = null; // help GC  
                return interrupted;  
            }  
            if (shouldParkAfterFailedAcquire(p, node) &&  
                parkAndCheckInterrupt())  
                interrupted = true;  
        }  
    } catch (RuntimeException ex) {  
        cancelAcquire(node);  
        throw ex;  
    }  
}  
```

仔细看看这个方法是个无限循环，感觉如果p == head && tryAcquire(arg)条件不满足循环将永远无法结束，当然不会出现死循环，**奥秘在于第12行的parkAndCheckInterrupt会把当前线程挂起，从而阻塞住线程的调用栈。**



```java
private final boolean parkAndCheckInterrupt() {  
    LockSupport.park(this);  
    return Thread.interrupted();  
}  
```

如前面所述，LockSupport.park最终把线程交给系统（Linux）内核进行阻塞。当然也不是马上把请求不到锁的线程进行阻塞，还要检查该线程的状态，比如如果该线程处于Cancel状态则没有必要，具体的检查在shouldParkAfterFailedAcquire中：



```java
 private static boolean shouldParkAfterFailedAcquire(Node pred, Node node) {  
      int ws = pred.waitStatus;  
      if (ws == Node.SIGNAL)  
          /* 
           * This node has already set status asking a release 
           * to signal it, so it can safely park 
           */  
          return true;  
      if (ws > 0) {  
          /* 
           * Predecessor was cancelled. Skip over predecessors and 
           * indicate retry. 
           */  
   do {  
node.prev = pred = pred.prev;  
   } while (pred.waitStatus > 0);  
   pred.next = node;  
      } else {  
          /* 
           * waitStatus must be 0 or PROPAGATE. Indicate that we 
           * need a signal, but don't park yet. Caller will need to 
           * retry to make sure it cannot acquire before parking.  
           */  
          compareAndSetWaitStatus(pred, ws, Node.SIGNAL);  
      }   
      return false;  
  }  
```

检查原则在于：

> **规则1**：如果前继的节点状态为SIGNAL，表明当前节点需要unpark，则返回成功，此时acquireQueued方法的第12行（parkAndCheckInterrupt）将导致线程阻塞
> **规则2**：如果前继节点状态为CANCELLED(ws>0)，说明前置节点已经被放弃，则回溯到一个非取消的前继节点，返回false，acquireQueued方法的无限循环将递归调用该方法，直至规则1返回true，导致线程阻塞
> **规则3**：如果前继节点状态为非SIGNAL、非CANCELLED，则设置前继的状态为SIGNAL，返回false后进入acquireQueued的无限循环，与规则2同
> 总体看来，shouldParkAfterFailedAcquire就是靠前继节点判断当前线程是否应该被阻塞，如果前继节点处于CANCELLED状态，则顺便删除这些节点重新构造队列。

**至此，锁住线程的逻辑已经完成，下面讨论解锁的过程。**

#### 3. 解锁

请求锁不成功的线程会被挂起在**acquireQueued**方法的第12行，12行以后的代码必须等线程被解锁锁才能执行，假如被阻塞的线程得到解锁，则执行第13行，即设置interrupted = true，之后又进入无限循环。

> 从无限循环的代码可以看出，并不是得到解锁的线程一定能获得锁，必须在第6行中调用tryAccquire重新竞争，因为锁是非公平的，有可能被新加入的线程获得，从而导致刚被唤醒的线程再次被阻塞，**这个细节充分体现了“非公平”的精髓**。通过之后将要介绍的解锁机制会看到，第一个被解锁的线程就是Head，因此p == head的判断基本都会成功。
> 至此可以看到，把tryAcquire方法延迟到子类中实现的做法非常精妙并具有极强的可扩展性，令人叹为观止！当然精妙的不是这个Templae设计模式，而是Doug Lea对锁结构的精心布局。

解锁代码相对简单，主要体现在**AbstractQueuedSynchronizer.release和Sync.tryRelease方法中：**
**class AbstractQueuedSynchronizer**



```java
public final boolean release(int arg) {  
    if (tryRelease(arg)) {  
        Node h = head;  
        if (h != null && h.waitStatus != 0)  
            unparkSuccessor(h);  
        return true;  
    }  
    return false;  
}  
```

**class Sync**



```java
protected final boolean tryRelease(int releases) {  
    int c = getState() - releases;  
    if (Thread.currentThread() != getExclusiveOwnerThread())  
        throw new IllegalMonitorStateException();  
    boolean free = false;  
    if (c == 0) {  
        free = true;  
        setExclusiveOwnerThread(null);  
    }  
    setState(c);  
    return free;  
}  
```

> tryRelease与tryAcquire语义相同，把如何释放的逻辑延迟到子类中。tryRelease语义很明确：如果线程多次锁定，则进行多次释放，直至status==0则真正释放锁，所谓释放锁即设置status为0，**因为无竞争所以没有使用CAS。**

release的语义在于：**如果可以释放锁，则唤醒队列第一个线程（Head）**，具体唤醒代码如下：



```csharp
private void unparkSuccessor(Node node) {  
    /* 
     * If status is negative (i.e., possibly needing signal) try 
     * to clear in anticipation of signalling. It is OK if this 
     * fails or if status is changed by waiting thread. 
     */  
    int ws = node.waitStatus;  
    if (ws < 0)  
        compareAndSetWaitStatus(node, ws, 0);   
  
    /* 
     * Thread to unpark is held in successor, which is normally 
     * just the next node.  But if cancelled or apparently null, 
     * traverse backwards from tail to find the actual 
     * non-cancelled successor. 
     */  
    Node s = node.next;  
    if (s == null || s.waitStatus > 0) {  
        s = null;  
        for (Node t = tail; t != null && t != node; t = t.prev)  
            if (t.waitStatus <= 0)  
                s = t;  
    }  
    if (s != null)  
        LockSupport.unpark(s.thread);  
}  
```

> **这段代码的意思在于找出第一个可以unpark的线程，一般说来head.next == head，Head就是第一个线程，但Head.next可能被取消或被置为null，因此比较稳妥的办法是从后往前找第一个可用线程。貌似回溯会导致性能降低，其实这个发生的几率很小，所以不会有性能影响。之后便是通知系统内核继续该线程，在Linux下是通过pthread_mutex_unlock完成。之后，被解锁的线程进入上面所说的重新竞争状态。**

#### 4. Lock VS Synchronized

AbstractQueuedSynchronizer通过构造一个基于阻塞的CLH队列容纳所有的阻塞线程，而对该队列的操作均通过Lock-Free（CAS）操作，但对已经获得锁的线程而言，ReentrantLock实现了偏向锁的功能。

synchronized的底层也是一个基于CAS操作的等待队列，但JVM实现的更精细，把等待队列分为ContentionList和EntryList，目的是为了降低线程的出列速度；当然也实现了偏向锁，从数据结构来说二者设计没有本质区别。但synchronized还实现了自旋锁，并针对不同的系统和硬件体系进行了优化，而Lock则完全依靠系统阻塞挂起等待线程。

当然Lock比synchronized更适合在应用层扩展，可以继承AbstractQueuedSynchronizer定义各种实现，比如实现读写锁（ReadWriteLock），公平或不公平锁；同时，Lock对应的Condition也比wait/notify要方便的多、灵活的多。