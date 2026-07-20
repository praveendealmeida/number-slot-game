import { View, Animated } from "react-native";
import { useRef, useEffect, memo } from "react";

type SkeletonProps = {
  className?: string;
};

function Skeleton({ className = "" }: SkeletonProps) {
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacityAnim]);

  return (
    <Animated.View
      style={{ opacity: opacityAnim }}
      className={`rounded-2xl ${className}`}
    />
  );
}

export { Skeleton };
export default memo(Skeleton);