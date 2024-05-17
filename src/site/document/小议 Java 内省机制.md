# 小议 Java 内省机制



## 基本概念

Wiki 中是这样描述内省的：

> 在计算机科学中，内省是指计算机程序在运行时（Run time）检查对象（Object）类型的一种能力，通常也可以称作运行时类型检查。

这个描述非常宽泛，但有三个关键词：

- 运行时
- 对象
- 类型

Java 官方对 Java Beans 内省的定义：

> At runtime and in the builder environment we need to be able to figure out which properties, events, and methods a Java Bean supports. We call this process introspection.

从 Java Bean 的角度来看，这里的对象就是 Bean 对象，主要关注点是属性、方法和事件等，也就是说在运行时可以获取相应的信息进行一些处理，这就是 Java Beans 的内省机制。

### 与反射的区别

Java Beans 内省其实就是对反射的一种封装，这个从源码中或者官方文档中都能看到：

> By default we will use a low level reflection mechanism to study the methods supported by a target bean and then apply simple design patterns to deduce from those methods what properties, events, and public methods are supported.

## Java Beans 内省机制

### 核心类库

Java Beans 内省机制的核心类是 `Introspector`：

```
* The Introspector class provides a standard way for tools to learn about
* the properties, events, and methods supported by a target Java Bean.
```

操作范围主要包括但不局限于 Java Beans 的属性，事件和方法，具体是基于以下几个类实现：

- ```
  BeanInfo
  ```

  - Java Bean 信息类

- ```
  PropertyDescriptor
  ```

  - 属性描述类

- ```
  MethodDescriptor
  ```

  - 方法描述类

- ```
  EventSetDescriptor
  ```

  - 事件描述集合

先看一个示例：

定义一个 Java Bean：

```
public class User {

    private String username;

    private Integer age;

    // getter/setter
    // toString

}
```

测试代码：

```
@Test
public void test1() throws IntrospectionException {
    //获取 User Bean 信息
    BeanInfo userBeanInfo = Introspector.getBeanInfo(User.class);
    //属性描述
    PropertyDescriptor[] propertyDescriptors = userBeanInfo.getPropertyDescriptors();
    System.out.println("属性描述：");
    Stream.of(propertyDescriptors).forEach(System.out::println);
    //方法描述
    System.out.println("方法描述：");
    MethodDescriptor[] methodDescriptors = userBeanInfo.getMethodDescriptors();
    Stream.of(methodDescriptors).forEach(System.out::println);
    //事件描述
    System.out.println("事件描述：");
    EventSetDescriptor[] eventSetDescriptors = userBeanInfo.getEventSetDescriptors();
    Stream.of(eventSetDescriptors).forEach(System.out::println);
}
```

输出结果：

```
属性描述：
java.beans.PropertyDescriptor[name=age; propertyType=class java.lang.Integer; readMethod=public java.lang.Integer introspector.bean.User.getAge(); writeMethod=public void introspector.bean.User.setAge(java.lang.Integer)]
java.beans.PropertyDescriptor[name=class; propertyType=class java.lang.Class; readMethod=public final native java.lang.Class java.lang.Object.getClass()]
java.beans.PropertyDescriptor[name=username; propertyType=class java.lang.String; readMethod=public java.lang.String introspector.bean.User.getUsername(); writeMethod=public void introspector.bean.User.setUsername(java.lang.String)]
方法描述：
java.beans.MethodDescriptor[name=getClass; method=public final native java.lang.Class java.lang.Object.getClass()]
java.beans.MethodDescriptor[name=setAge; method=public void introspector.bean.User.setAge(java.lang.Integer)]
java.beans.MethodDescriptor[name=getAge; method=public java.lang.Integer introspector.bean.User.getAge()]
java.beans.MethodDescriptor[name=wait; method=public final void java.lang.Object.wait(long,int) throws java.lang.InterruptedException]
java.beans.MethodDescriptor[name=notifyAll; method=public final native void java.lang.Object.notifyAll()]
java.beans.MethodDescriptor[name=notify; method=public final native void java.lang.Object.notify()]
java.beans.MethodDescriptor[name=getUsername; method=public java.lang.String introspector.bean.User.getUsername()]
java.beans.MethodDescriptor[name=wait; method=public final void java.lang.Object.wait() throws java.lang.InterruptedException]
java.beans.MethodDescriptor[name=hashCode; method=public native int java.lang.Object.hashCode()]
java.beans.MethodDescriptor[name=setUsername; method=public void introspector.bean.User.setUsername(java.lang.String)]
java.beans.MethodDescriptor[name=wait; method=public final native void java.lang.Object.wait(long) throws java.lang.InterruptedException]
java.beans.MethodDescriptor[name=equals; method=public boolean java.lang.Object.equals(java.lang.Object)]
java.beans.MethodDescriptor[name=toString; method=public java.lang.String introspector.bean.User.toString()]
事件描述：
```

可以看出通过内省机制可以获取 Java Bean 的属性、方法描述，这里事件描述是空的（关于事件相关会在后面介绍）。由于 Java 类都会继承 `Object` 类，可以看到这里将 `Object` 类相关的属性和方法描述也输出了，如果想将某个类的描述信息排除可以使用 `java.beans.Introspector#getBeanInfo(java.lang.Class<?>, java.lang.Class<?>)` 这个方法。

### 属性处理

#### 配置绑定

通过 `PropertyDescriptor` 可以基于字段名为可写属性设置值。

比如我们经常会使用这样的配置文件：

```
user:
  username: zhangsan
  age: 1
```

配置文件会与对象进行数据绑定。测试代码：

```
@Test
public void test2() throws IntrospectionException {
    YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
    yaml.setResources(new ClassPathResource("application.yml"));
    String path = "user.";
    Properties properties = yaml.getObject();
    System.out.println(properties);
    User user = new User();
    //获取 User Bean 信息，排除 Object
    BeanInfo userBeanInfo = Introspector.getBeanInfo(User.class, Object.class);
    //属性描述
    PropertyDescriptor[] propertyDescriptors = userBeanInfo.getPropertyDescriptors();
    Stream.of(propertyDescriptors).forEach(propertyDescriptor -> {
        //获取属性名称
        String property = propertyDescriptor.getName();
        try {
            propertyDescriptor.getWriteMethod().invoke(user,properties.get(path+property));
        } catch (IllegalAccessException | InvocationTargetException ignored) {
        }
    });
    System.out.println(user);
}
```

输出结果：

```
User{username='zhangsan', age=1}
```

##### 在 Spring 中的使用

在传统的 Spring 开发中我们需要在 web.xml 中指定一些配置参数，比如：

```
<servlet>
    <servlet-name>app</servlet-name>
    <servlet-class>org.springframework.web.servlet.DispatcherServlet</servlet-class>
    <init-param>
        <param-name>contextConfigLocation</param-name>
        <param-value></param-value>
    </init-param>
    <load-on-startup>1</load-on-startup>
</servlet>
```

这里有一个 `contextConfigLocation` 参数，这个参数最终是与 `FrameworkServlet` 类中的一个属性进行绑定：

```
public abstract class FrameworkServlet extends HttpServletBean implements ApplicationContextAware {
  private String contextConfigLocation;
}
```

那么 Spring 是如何将 web.xml 中的配置项与属性进行绑定的呢，可以参数看`org.springframework.web.servlet.HttpServletBean#init()` 方法：

```
@Override
public final void init() throws ServletException {

  // Set bean properties from init parameters.
  PropertyValues pvs = new ServletConfigPropertyValues(getServletConfig(), this.requiredProperties);
  if (!pvs.isEmpty()) {
    try {
      BeanWrapper bw = PropertyAccessorFactory.forBeanPropertyAccess(this);
      ResourceLoader resourceLoader = new ServletContextResourceLoader(getServletContext());
      bw.registerCustomEditor(Resource.class, new ResourceEditor(resourceLoader, getEnvironment()));
      initBeanWrapper(bw);
      bw.setPropertyValues(pvs, true);
    }
    catch (BeansException ex) {
      if (logger.isErrorEnabled()) {
        logger.error("Failed to set bean properties on servlet '" + getServletName() + "'", ex);
      }
      throw ex;
    }
  }

  // Let subclasses do whatever initialization they like.
  initServletBean();
}
```

可以看到 Spring 是通过 `BeanWrapper` 完成对属性的绑定：

```
public interface BeanWrapper extends ConfigurablePropertyAccessor {
    // 获取属性描述器
    PropertyDescriptor[] getPropertyDescriptors();

    PropertyDescriptor getPropertyDescriptor(String var1) throws InvalidPropertyException;
}
```

而 `BeanWrapper` 又继承了 `PropertyAccessor` 接口：

```
public interface PropertyAccessor {
    //读属性
    boolean isReadableProperty(String var1);
    //写属性
    boolean isWritableProperty(String var1);

    @Nullable
    Class<?> getPropertyType(String var1) throws BeansException;

    @Nullable
    TypeDescriptor getPropertyTypeDescriptor(String var1) throws BeansException;
}
```

也就是说 Spring 中 `BeanWrapper` 基于 Java 的内省机制实现了对属性的赋值工作，但是 Spring 并未局限于 Java 提供的 API，而是也进行了扩展和进一步的封装，如 `TypeDescriptor`。

可以参考 `org.springframework.web.servlet.HttpServletBean#init()` 中 `BeanWrapper` 的使用来实现对 `User` 对象的属性赋值：

```
@Test
public void test5(){
    User user = new User();
    BeanWrapper bw = PropertyAccessorFactory.forBeanPropertyAccess(user);
    MutablePropertyValues pvs = new MutablePropertyValues();
    pvs.add("username","zhangsan");
    pvs.add("age",1);
    bw.setPropertyValues(pvs);
    System.out.println(user);
}
```

输出结果：

```
User{username='zhangsan', age=1}
```

#### 类型转换

有属性赋值，必然就会有类型转换。说白了我们从配置文件读取的数据是字符串，与属性进行参数绑定的过程中势必会有类型转换，`java.beans` 中提供了相应的 API：

- ```
  PropertyEditor
  ```

  - 属性编辑器顶层接口

- ```
  PropertyEditorSupport
  ```

  - 属性编辑器实现类

- ```
  PropertyEditorManager
  ```

  - 属性编辑器管理器
  - 在 Spring 中提供了一个 `PropertyEditorRegistrar`

先看一个例子：

User 类增加 Date 属性：

```
public class User {

    private String username;

    private Integer age;
  
    private Date createTime;

    // getter/setter
    // toString

}
```

日期转换器：

```
/**
 * 日期属性编辑器
 */
public class DatPropertyEditor extends PropertyEditorSupport {
    @Override
    public void setAsText(String text) {
        try {
            setValue((text == null) ? null : new SimpleDateFormat("yyyy-MM-dd").parse(text));
        } catch (ParseException e) {
            e.printStackTrace();
        }
    }
}
```

在之前的例子中内省设置属性值都是直接通过 `PropertyDescriptor` 获取属性的写方法通过反射去赋值，而如果需要对值进行类型转换，则需要通过 `PropertyEditorSupport#setAsText` 调用 `setValue` 方法，然后 `setValue` 方法触发属性属性修改事件：

```
public class PropertyEditorSupport implements PropertyEditor {

    public void setValue(Object value) {
        this.value = value;
        firePropertyChange();
    }
}
```

要注意这里的 `value` 实际上是临时存储在 `PropertyEditorSupport` 中，`PropertyEditorSupport` 则作为事件源，从而得到类型转换后的 `value`，再通过 `PropertyDescriptor` 获取属性的写方法通过反射去赋值。

测试代码：

```
@Test
public void test6() throws IntrospectionException, FileNotFoundException {
   Map<String,Object> properties = ImmutableMap.of("age",1,"username","zhangsan","createTime","2020-01-01");
    User user = new User();
    //获取 User Bean 信息，排除 Object
    BeanInfo userBeanInfo = Introspector.getBeanInfo(User.class, Object.class);
    //属性描述
    PropertyDescriptor[] propertyDescriptors = userBeanInfo.getPropertyDescriptors();
    Stream.of(propertyDescriptors).forEach(propertyDescriptor -> {
        //获取属性名称
        String property = propertyDescriptor.getName();
        //值
        Object value = properties.get(property);
        if (Objects.equals("createTime", property)) {
            //设置属性编辑器
            propertyDescriptor.setPropertyEditorClass(DatPropertyEditor.class);
            //创建属性编辑器
            PropertyEditor propertyEditor = propertyDescriptor.createPropertyEditor(user);
            //添加监听器
            propertyEditor.addPropertyChangeListener(evt -> {
                //获取转换后的value
                Object value1 = propertyEditor.getValue();
                setPropertyValue(user, propertyDescriptor, value1);
            });
            propertyEditor.setAsText(String.valueOf(value));
            return;
        }
        setPropertyValue(user, propertyDescriptor, value);
    });
    System.out.println(user);
}

/**
 * 设置属性值
 */
private void setPropertyValue(User user, PropertyDescriptor propertyDescriptor, Object value1) {
    try {
        propertyDescriptor.getWriteMethod().invoke(user, value1);
    } catch (IllegalAccessException | InvocationTargetException ignored) {
    }
}
```

输出结果：

```
User{username='zhangsan', age=1, createTime=2020-1-1 0:00:00}
```

### 事件监听

先举一个的例子，在 Mac 中设置飞书通知方式的时候，当界面右侧选择“提示”的时候，那么左侧也会相应的显示为“提示”：

![img](https://xiaomi-info.github.io/2020/03/16/java-beans-introspection/java-beans-introspection-01.png)

如果将右侧看成一个 Java Bean，那么这中间势必存在一个属性变化监听。`java.beans` 包中也提供了相应实现：

- ```
  PropertyChangeEvent
  ```

  - 属性变化事件

- ```
  PropertyChangeListener
  ```

  - 属性（生效）变化监听器

- ```
  PropertyChangeSupport
  ```

  - 属性（生效）变化监听器管理器’

- ```
  VetoableChangeListener
  ```

  - 属性（否决）变化监听器

- ```
  VetoableChangeSupport
  ```

  - 属性（否决）变化监听器管理器

`PropertyChangeEvent` 的构造方法：

```
public PropertyChangeEvent(Object source, String propertyName,
    Object oldValue, Object newValue) {
    super(source);
    this.propertyName = propertyName;
    this.newValue = newValue;
    this.oldValue = oldValue;
}
```

通过这个构造方法可以看出属性变化监听的关注点：

- ```
  source
  ```

  - 事件源

- ```
  propertyName
  ```

  - 发生变化的属性名称

- ```
  oldValue
  ```

  - 旧值

- ```
  newValue
  ```

  - 新值

示例代码：

在 `User` 中增加属性（生效）变化监听：

```
public class User {

    private String username;

    private Integer age;

    /**
     * 属性（生效）变化监听器管理器
     */
    private PropertyChangeSupport propertyChangeSupport = new PropertyChangeSupport(this);

    /**
     * 启动属性（生效）变化
     * @param propertyName 
     * @param oldValue 
     * @param newValue
     */
    private void firePropertyChange(String propertyName, String oldValue, String newValue) {
        PropertyChangeEvent event = new PropertyChangeEvent(this, propertyName, oldValue, newValue);
        propertyChangeSupport.firePropertyChange(event);
    }

    /**
     * 添加属性（生效）变化监听器
     */
    public void addPropertyChangeListener(PropertyChangeListener listener){
        propertyChangeSupport.addPropertyChangeListener(listener);
    }

    /**
     * 删除属性（生效）变化监听器
     */
    public void removePropertyChangeListener(PropertyChangeListener listener){
        propertyChangeSupport.removePropertyChangeListener(listener);
    }

    /**
     * 获取属性（生效）变化监听器
     */
    public PropertyChangeListener[] getPropertyChangeListeners() {
        return propertyChangeSupport.getPropertyChangeListeners();
    }

    public void setUsername(String username) {
        String oldValue = this.username;
        this.username = username;
        firePropertyChange("username", oldValue, username);
    }
  
   // getter/setter
   // toString
}
```

测试代码：

```
@Test
public void test3(){
    User user = new User();
    user.setAge(1);
    user.setUsername("zhangsan");
    user.addPropertyChangeListener(System.out::println);
    user.setUsername("lisi");
    user.setUsername("wangwu");
}
```

输出结果：

```
java.beans.PropertyChangeEvent[propertyName=name; oldValue=zhangsan; newValue=lisi; propagationId=null; source=User{username='lisi', age=1}]
java.beans.PropertyChangeEvent[propertyName=name; oldValue=lisi; newValue=wangwu; propagationId=null; source=User{username='wangwu', age=1}]
```

可以看到在添加了监听器后，当 username 属性发生变化的时候会出发监听事件。

再看看另外一种监听器 `VetoableChangeListener`。在 `User` 中添加监听器：

```
/**
 * 属性（否决）变化监听器
 */
private VetoableChangeSupport vetoableChangeSupport = new VetoableChangeSupport(this);

/**
 * 启动属性（否决）变化
 * @param propertyName
 * @param oldValue
 * @param newValue
 */
private void fireVetoableChange(String propertyName, String oldValue, String newValue) throws PropertyVetoException {
    PropertyChangeEvent event = new PropertyChangeEvent(this, propertyName, oldValue, newValue);
    vetoableChangeSupport.fireVetoableChange(event);
}

/**
 * 添加属性（否决）变化监听器
 */
public void addVetoableChangeListener(VetoableChangeListener listener){
    vetoableChangeSupport.addVetoableChangeListener(listener);
}

/**
 * 删除属性（否决）变化监听器
 */
public void removeVetoableChangeListener(VetoableChangeListener listener){
    vetoableChangeSupport.removeVetoableChangeListener(listener);
}

public void setUsername(String username) throws PropertyVetoException {
    String oldValue = this.username;
    fireVetoableChange("username",oldValue,username);
    this.username = username;
    firePropertyChange("username", oldValue, username);
}
```

测试代码：

```java
@Test
public void test3() throws PropertyVetoException {
    User user = new User();
    user.setAge(1);
    user.addVetoableChangeListener(evt -> {
        System.out.println(evt.getNewValue()+",,"+evt.getOldValue());
        if (Objects.equals(evt.getNewValue(), evt.getOldValue())) {
            throw new PropertyVetoException("当前属性值未发生任何变化", evt);
        }
    });
    user.addPropertyChangeListener(System.out::println);
    user.setUsername("lisi");
    user.setUsername("zhangsan");
    user.setUsername("zhangsan");
}
```

运行时发现一直无法抛出异常。查看源码发现 `PropertyChangeSupport` 和 `VetoableChangeSupport` 当新旧值相等时不会触发监听，于是修改测试代码：

```
@Test
public void test3() throws PropertyVetoException {
    User user = new User();
    user.setAge(1);
    user.addVetoableChangeListener(evt -> {
        System.out.println(evt.getNewValue()+",,"+evt.getOldValue());
        if (Objects.isNull(evt.getNewValue())) {
            throw new PropertyVetoException("username 不能为null", evt);
        }
    });
    user.addPropertyChangeListener(System.out::println);
    user.setUsername("lisi");
    user.setUsername(null);
}
```

运行结果：

```
lisi,,null
java.beans.PropertyChangeEvent[propertyName=username; oldValue=null; newValue=lisi; propagationId=null; source=User{username='lisi', age=1}]
null,,lisi

java.beans.PropertyVetoException: username 不能为null

  at introspector.test.IntrospectorTest.lambda$test3$1(IntrospectorTest.java:78)
  at java.beans.VetoableChangeSupport.fireVetoableChange(VetoableChangeSupport.java:375)
```

可以发现当符合“否决”属性变化的条件时，会抛出 `PropertyVetoException` 异常阻断属性的变化。

在之前的示例中 `userBeanInfo` 输出的 `EventSetDescriptor` 为空，这是因为并未到 `User` 类中增加事件。现在再测试一下获取 `EventSetDescriptor`：

```
@Test
public void test1() throws IntrospectionException {
    BeanInfo userBeanInfo = Introspector.getBeanInfo(User.class, Object.class);
    EventSetDescriptor[] eventSetDescriptors = userBeanInfo.getEventSetDescriptors();
    Stream.of(eventSetDescriptors).forEach(System.out::println);
}
```

输出结果：

```
java.beans.EventSetDescriptor[name=propertyChange; inDefaultEventSet; listenerType=interface java.beans.PropertyChangeListener; getListenerMethod=public java.beans.PropertyChangeListener[] introspector.bean.User.getPropertyChangeListeners(); addListenerMethod=public void introspector.bean.User.addPropertyChangeListener(java.beans.PropertyChangeListener); removeListenerMethod=public void introspector.bean.User.removePropertyChangeListener(java.beans.PropertyChangeListener)]
java.beans.EventSetDescriptor[name=vetoableChange; inDefaultEventSet; listenerType=interface java.beans.VetoableChangeListener; addListenerMethod=public void introspector.bean.User.addVetoableChangeListener(java.beans.VetoableChangeListener); removeListenerMethod=public void introspector.bean.User.removeVetoableChangeListener(java.beans.VetoableChangeListener)]
```

## 其他

在 Java 生态飞速发展的今天，很多底层技术细节都被高级框架所屏蔽，而 Java Beans 就是其中一种。也许平时根本就用不到，但是其代码设计和思想理念不应该被忽视。Dubbo 2.7 之后提出了“服务自省”的概念，其灵感就来源于 Java Beans 内省机制。