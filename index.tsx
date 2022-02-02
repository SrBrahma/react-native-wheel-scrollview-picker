import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions, NativeScrollEvent, NativeSyntheticEvent, Platform,
  Pressable,
  ScrollView, StyleProp, StyleSheet, Text, View, ViewProps, ViewStyle,
} from 'react-native';



function isNumeric(str: string | unknown): boolean {
  if (typeof str === 'number') return true;
  if (typeof str !== 'string') return false;
  return (
    !isNaN(str as unknown as number) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str))
  ); // ...and ensure strings of whitespace fail
}

const deviceWidth = Dimensions.get('window').width;

const isViewStyle = (style: ViewProps['style']): style is ViewStyle => {
  return (
    typeof style === 'object' &&
    style !== null &&
    Object.keys(style).includes('height')
  );
};

export type ScrollPickerProps<T = unknown> = {
  /** @default [] */
  data?: T[];
  /** Style of the wrapping view. You may use this to set the backgroundColor. */
  containerStyle?: StyleProp<ViewStyle>;
  style?: ViewProps['style'];
  selectedIndex?: number;
  onValueChange?: (p: {value: T; index: number}) => void;
  renderItem?: (p: {item: T; index: number; isSelected: boolean}) => JSX.Element;
  /** Index is used by default. */
  keyExtractor?: (p: {item: T; index: number}) => React.Key;
  /** @default '#333' */
  highlightColor?: string;
  /** @default 30 */
  itemHeight?: number;
  /** The height of the container. Fallbacks to containerStyleHeight, then to itemHeight * 5. */
  containerHeight?: number;
};

function constrainIndex(index: number | undefined, dataLength: number) {
  return Math.max(0, Math.min(index ?? 0, dataLength - 1));
}

export default function ScrollPicker<T>({
  itemHeight = 30, data = [], highlightColor = '#333', ...p
}: ScrollPickerProps<T>): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(constrainIndex(p.selectedIndex, data.length));
  const sView = useRef<ScrollView>(null);
  const [isScrollTo, setIsScrollTo] = useState(false);
  const [dragStarted, setDragStarted] = useState(false);
  const [momentumStarted, setMomentumStarted] = useState(false);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  const wrapperHeight =
  p.containerHeight ||
    (isViewStyle(p.style) && isNumeric(p.style.height)
      ? Number(p.style.height)
      : 0) ||
      itemHeight * 5; // To have 5 items being shown

  const initialized = useRef(false);

  useEffect(function initialize() {
    if (initialized.current) return;
    initialized.current = true;
    /** If the selectedIndex prop value is different from the component selectedIndex on init, trigger onChange */
    if (p.selectedIndex !== undefined && p.selectedIndex !== selectedIndex)
      p.onValueChange?.({ value: data[selectedIndex]!, index: selectedIndex });
    // There was a setTimeout(..., 0) here but it would cause a flicker if the picker didn't keep its state and got it from parents.
    const y = itemHeight * selectedIndex;
    sView.current?.scrollTo({ y, animated: false });
    // setTimeout(() => {
    // }, 0);

    // return () => { timer && clearTimeout(timer); };
  }, [initialized, itemHeight, selectedIndex, sView, timer, p.selectedIndex, p, data]);


  const renderItem = (item: T, index: number) => {
    const isSelected = index === selectedIndex;
    const element = p.renderItem
      ? p.renderItem({ item, index, isSelected })
      : <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>{item}</Text>;

    return (
      <View style={[styles.itemWrapper, { height: itemHeight }]} key={p.keyExtractor?.({ item, index }) ?? index}>
        {element}
      </View>
    );
  };


  const scrollFix = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    let y = 0;
    const h = itemHeight;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (e.nativeEvent.contentOffset) // check needed?
      y = e.nativeEvent.contentOffset.y;

    const _selectedIndex = Math.round(y / h);

    const _y = _selectedIndex * h;
    if (_y !== y) {
      // using scrollTo in ios, onMomentumScrollEnd will be invoked
      if (Platform.OS === 'ios')
        setIsScrollTo(true);
      sView.current?.scrollTo({ y: _y });
    }
    if (selectedIndex === _selectedIndex)
      return;

    setSelectedIndex(_selectedIndex);
    p.onValueChange?.({ value: data[_selectedIndex]!, index: _selectedIndex });

  }, [data, itemHeight, p, selectedIndex]);


  const onScrollBeginDrag = () => {
    setDragStarted(true);
    if (Platform.OS === 'ios')
      setIsScrollTo(false);
    timer && clearTimeout(timer);
  };
  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setDragStarted(false);
    // if not used, event will be garbaged
    const _e: NativeSyntheticEvent<NativeScrollEvent> = { ...e };
    timer && clearTimeout(timer);
    setTimer(setTimeout(() => !momentumStarted && scrollFix(_e), 50));
  };
  const onMomentumScrollBegin = () => {
    setMomentumStarted(true);
    timer && clearTimeout(timer);
  };
  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setMomentumStarted(false);
    if (!isScrollTo && !dragStarted)
      scrollFix(e);
  };


  /** Before the first item and after the last item. Allows vertical centering the firsts and lasts items. */
  const verticalSpacing = () => {
    const h = (wrapperHeight - itemHeight) / 2;
    return <View style={{ height: h, flex: 1 }}/>;
  };


  const highlightWidth = (isViewStyle(p.style) ? p.style.width : 0) || deviceWidth;


  const highlightStyle: ViewStyle = {
    position: 'absolute',
    top: (wrapperHeight - itemHeight) / 2,
    height: itemHeight,
    width: highlightWidth,
    borderColor: highlightColor,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  };


  return (


    <View
      style={[styles.containerStyle, { height: wrapperHeight }, p.containerStyle]}
    >
      <View style={highlightStyle}/>
      <ScrollView
        ref={sView}
        bounces={false}
        showsVerticalScrollIndicator={false}
        onMomentumScrollBegin={onMomentumScrollBegin}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        overScrollMode='never'
      >
        {/* Pressable to fix scroll hardly working https://stackoverflow.com/a/67028240/10247962 */}
        <Pressable>
          {verticalSpacing()}
          {data.map(renderItem)}
          {verticalSpacing()}
        </Pressable>
      </ScrollView>
    </View>
  );
}



const styles = StyleSheet.create({
  containerStyle: {
    flex: 1,
    overflow: 'hidden',
  },
  itemWrapper: {
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    color: '#999',
  },
  itemTextSelected: {
    color: '#333',
  },
});
