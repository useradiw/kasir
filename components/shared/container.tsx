interface Props {
    children: React.ReactNode,
    id: string,
    sectionStyle?: string,
    className?: string,
}

const Container = ({ children, id, sectionStyle, className }: Props) => {
    return (
        <section id={id} className={`${sectionStyle}`}>
            <div className={`max-w-lg mx-auto py-3 px-3 md:px-0 ${className}`}>
                {children}
            </div>
        </section>
    )
};

export { Container };